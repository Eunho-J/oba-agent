import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:8787";

const SAMPLE_SURFACE = {
  kind: "imageGallery",
  type: "image.gallery",
  title: "Sample Fallback",
  sourceUrl: "sample://fallback",
  images: [
    {
      url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5",
      caption: "Fallback reference image",
      source: "sample"
    },
    {
      url: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601",
      caption: "Fallback detail image",
      source: "sample"
    }
  ]
};

const INITIAL_MESSAGES = [
  {
    id: "assistant-initial",
    role: "assistant",
    text: "무엇을 도와드릴까요?"
  }
];

export default function App() {
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY_URL);
  const [errorText, setErrorText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [providerStatus, setProviderStatus] = useState(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);

  const normalizedGatewayUrl = useMemo(() => gatewayUrl.trim().replace(/\/+$/, ""), [gatewayUrl]);

  async function checkConnections() {
    const baseUrl = ensureGatewayUrl();
    if (!baseUrl) return;

    setIsChecking(true);
    setErrorText("");

    try {
      const response = await fetch(`${baseUrl}/providers/health`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.providers) {
        throw new Error(body?.error?.message || `gateway returned ${response.status}`);
      }
      setProviderStatus(body.providers);
    } catch (error) {
      setProviderStatus(null);
      setErrorText(`연결 확인 실패: ${formatError(error)}`);
    } finally {
      setIsChecking(false);
    }
  }

  async function sendMessage() {
    const baseUrl = ensureGatewayUrl();
    const text = messageText.trim();
    if (!baseUrl || !text) return;

    const userMessage = createMessage("user", text);
    setMessages((current) => [...current, userMessage]);
    setMessageText("");
    setIsSending(true);
    setErrorText("");

    try {
      const response = await fetch(`${baseUrl}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: "browser-ui",
          toolMode: "enabled"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error?.message || `gateway returned ${response.status}`);
      }
      setMessages((current) => [...current, createMessage("assistant", extractTurnAnswer(body), "final", {
        metadata: body?.metadata || {},
        toolCalls: Array.isArray(body?.toolCalls) ? body.toolCalls : [],
        provider: body?.provider || {},
        gguiAttachments: normalizeOptionalSurfaces(body?.gguiAttachments, body?.surface)
      })]);
    } catch (error) {
      const textError = `응답 실패: ${formatError(error)}`;
      setErrorText(textError);
      setMessages((current) => [...current, createMessage("assistant", textError, "error")]);
    } finally {
      setIsSending(false);
    }
  }

  async function startVoiceRecording() {
    const baseUrl = ensureGatewayUrl();
    if (!baseUrl) return;
    if (isDeniedMicrophoneSimulated()) {
      setErrorText("마이크 권한 또는 녹음 실패: Permission denied");
      return;
    }
    if (isFakeMicrophoneEnabled()) {
      setIsRecording(true);
      setIsTranscribing(false);
      setErrorText("");
      mediaRecorderRef.current = createFakeMicrophoneRecorder();
      mediaRecorderRef.current.start();
      return;
    }
    if (Platform.OS !== "web" || typeof navigator === "undefined") {
      setErrorText("마이크 입력은 웹 브라우저에서만 사용할 수 있습니다.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setErrorText("이 브라우저에서 마이크 녹음을 사용할 수 없습니다.");
      return;
    }

    setIsRecording(true);
    setIsTranscribing(true);
    setErrorText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordingChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        setErrorText(`음성 입력 실패: ${formatError(event.error || event)}`);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const audioBlob = new Blob(recordingChunksRef.current, { type: mimeType });
        stopMediaTracks();
        transcribeRecordedBlob(audioBlob, mimeType);
      };
      recorder.start();
      setIsTranscribing(false);
    } catch (error) {
      stopMediaTracks();
      setIsRecording(false);
      setIsTranscribing(false);
      setErrorText(`마이크 권한 또는 녹음 실패: ${formatError(error)}`);
    }
  }

  function stopVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopMediaTracks();
      setIsRecording(false);
      setIsTranscribing(false);
      return;
    }
    recorder.stop();
  }

  async function transcribeRecordedBlob(audioBlob, mimeType) {
    const baseUrl = ensureGatewayUrl();
    if (!baseUrl) return;

    setIsTranscribing(true);
    setErrorText("");
    try {
      const extension = mimeType.includes("ogg") ? "ogg" : "webm";
      const formData = new FormData();
      formData.append("audio", audioBlob, `microphone.${extension}`);
      const response = await fetch(`${baseUrl}/voice/transcribe`, {
        method: "POST",
        body: formData
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.ok === false || typeof body?.text !== "string") {
        throw new Error(body?.error?.message || `gateway returned ${response.status}`);
      }
      setMessageText(body.text);
    } catch (error) {
      setErrorText(`음성 입력 실패: ${formatError(error)}`);
    } finally {
      setIsTranscribing(false);
      setIsRecording(false);
      mediaRecorderRef.current = null;
      recordingChunksRef.current = [];
    }
  }

  function toggleVoiceRecording() {
    if (isRecording) stopVoiceRecording();
    else startVoiceRecording();
  }

  function stopMediaTracks() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function createFakeMicrophoneRecorder() {
    return {
      state: "recording",
      start() {
        this.state = "recording";
      },
      stop() {
        this.state = "inactive";
        const blob = new Blob(["fake microphone audio"], { type: "audio/webm" });
        transcribeRecordedBlob(blob, "audio/webm");
      }
    };
  }

  function ensureGatewayUrl() {
    if (!normalizedGatewayUrl) {
      setErrorText("Gateway URL을 입력해 주세요.");
      return "";
    }
    return normalizedGatewayUrl;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>OBA Chat</Text>
          <ActionButton
            label="Check"
            loading={isChecking}
            onPress={checkConnections}
            variant="quiet"
            testID="check-connections"
          />
        </View>

        <View style={styles.gatewayBar}>
          <TextInput
            value={gatewayUrl}
            onChangeText={setGatewayUrl}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Gateway URL"
            testID="gateway-url"
            placeholder={DEFAULT_GATEWAY_URL}
            style={[styles.input, styles.gatewayInput]}
          />
          <ProviderStatus providers={providerStatus} />
        </View>

        <View style={styles.chatPanel}>
          <View style={styles.messageList}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} debugEnabled={debugEnabled} />
            ))}
          </View>
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            multiline
            accessibilityLabel="Message"
            testID="message-input"
            placeholder="Message"
            style={[styles.input, styles.messageInput]}
          />
          <View style={styles.chatActions}>
            <ActionButton
              label="Send"
              loading={isSending}
              onPress={sendMessage}
              variant="primary"
              testID="send-message"
            />
            <ActionButton
              label={isRecording ? "Stop" : "Voice"}
              loading={isTranscribing && !isRecording}
              onPress={toggleVoiceRecording}
              variant={isRecording ? "recording" : "quiet"}
              testID="voice-input"
            />
            <ActionButton
              label={debugEnabled ? "Debug On" : "Debug Off"}
              onPress={() => setDebugEnabled((value) => !value)}
              variant={debugEnabled ? "toggleOn" : "toggleOff"}
            />
          </View>
        </View>

        {errorText ? <ErrorNotice message={errorText} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function ProviderStatus({ providers }) {
  if (!providers) {
    return <Text style={styles.noticeText}>상태 미확인</Text>;
  }
  return (
    <View style={styles.statusGrid}>
      <StatusPill label="codex-as-api" provider={providers.codexAsApi} />
      <StatusPill label="LM Studio" provider={providers.lmstudio} />
    </View>
  );
}

function StatusPill({ label, provider }) {
  const reachable = Boolean(provider?.reachable);
  const text = reachable ? "online" : provider?.error || "offline";
  return (
    <View style={[styles.statusPill, reachable ? styles.statusOnline : styles.statusOffline]}>
      <Text style={styles.statusName}>{label}</Text>
      <Text style={styles.statusText}>{text}</Text>
    </View>
  );
}

function MessageBubble({ message, debugEnabled }) {
  const isUser = message.role === "user";
  const showDebugPanel = debugEnabled && !isUser && message.kind === "final";
  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={styles.messageRole}>{isUser ? "You" : message.kind === "final" ? "EXAONE" : "OBA"}</Text>
      <ReadableText kind={message.kind === "error" ? "error" : "message"}>{message.text}</ReadableText>
      {(message.gguiAttachments || []).map((surface, index) => (
        <InlineSurface key={`${surface.type || surface.kind}-${index}`} surface={surface} />
      ))}
      {showDebugPanel ? <DebugPanel message={message} /> : null}
    </View>
  );
}

function InlineSurface({ surface }) {
  if (!surface) return null;
  if (surface.kind === "comparisonTable") {
    return <ComparisonSurface surface={surface} />;
  }
  if (surface.kind !== "imageGallery") return null;
  const title = surface.title || "Gallery";
  const images = surface.images || [];
  return (
    <View style={styles.inlineSurface} testID="inline-ggui-surface">
      <ReadableText kind="surfaceTitle">{title}</ReadableText>
      {surface.sourceUrl
        ? (
          <Pressable onPress={() => Linking.openURL(surface.sourceUrl)}>
            <Text style={styles.linkText}>{surface.sourceUrl}</Text>
          </Pressable>
        )
        : null}
      <View style={styles.photoList}>
        {images.map((photo) => (
          <View key={photo.url} style={styles.photoCard}>
            <Image source={{ uri: photo.url }} style={styles.photoImage} resizeMode="cover" />
            <View style={styles.photoMeta}>
              <ReadableText kind="photoCaption">{photo.caption || "No caption"}</ReadableText>
              <ReadableText kind="photoUrl">{photo.url}</ReadableText>
              {photo.source ? <Text style={styles.photoSource}>source: {photo.source}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function ComparisonSurface({ surface }) {
  return (
    <View style={styles.inlineSurface} testID="inline-ggui-surface">
      <ReadableText kind="surfaceTitle">{surface.title || "Comparison"}</ReadableText>
      <View style={styles.tableSurface}>
        <View style={styles.tableRow}>
          {surface.columns.map((column) => (
            <Text key={column.key} style={styles.tableHeader}>{column.label}</Text>
          ))}
        </View>
        {surface.items.map((item, index) => (
          <View key={`${index}-${JSON.stringify(item).slice(0, 20)}`} style={styles.tableRow}>
            {surface.columns.map((column) => (
              <Text key={column.key} style={styles.tableCell}>{String(item[column.key] ?? "")}</Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function DebugPanel({ message }) {
  const metadata = message?.metadata || {};
  const debug = metadata?.debug || {};
  const mainAgent = debug?.mainAgent || {};
  const inputTranslation = debug?.inputTranslation || debug?.exaoneInput || {};
  const exaoneFinal = debug?.exaoneFinal || debug?.exaone || {};

  const mainInput = mainAgent?.input?.messages || mainAgent?.messages || [];
  const mainOutput = mainAgent?.output || metadata?.mainAgentAnswer || "";
  const mainToolCalls = mainAgent?.toolCalls || message?.toolCalls || [];
  const exaoneUserInput = inputTranslation?.input?.messages || [];
  const exaoneUserOutput = inputTranslation?.rawOutput || inputTranslation?.output || metadata?.inputTranslationAnswer || "";
  const exaoneFinalInput = exaoneFinal?.input?.messages || [];
  const exaoneFinalOutput = exaoneFinal?.output || message?.text || "";

  return (
    <View style={styles.debugPanel}>
      <Text style={styles.debugTitle}>Debug</Text>
      <Text style={styles.debugLine}>Main Provider: {mainAgent?.provider || "n/a"}</Text>
      <Text style={styles.debugLine}>Final Provider: {metadata?.finalAnswerProvider || "n/a"}</Text>
      <Text style={styles.debugLine}>Main Agent Input: {metadata?.mainAgentInput || "n/a"}</Text>
      <DebugBlock label="EXAONE User Input" value={compactJson(exaoneUserInput)} />
      <DebugBlock label="EXAONE User Output" value={stringifyValue(exaoneUserOutput)} />
      <DebugBlock label="Main Input" value={compactJson(mainInput)} />
      <DebugBlock label="Main Output" value={stringifyValue(mainOutput)} />
      <DebugBlock label="Tool Calls" value={compactJson(mainToolCalls)} />
      <DebugBlock label="EXAONE Final Input" value={compactJson(exaoneFinalInput)} />
      <DebugBlock label="EXAONE Final Output" value={stringifyValue(exaoneFinalOutput)} />
    </View>
  );
}

function DebugBlock({ label, value }) {
  return (
    <View style={styles.debugBlock}>
      <Text style={styles.debugLabel}>{label}</Text>
      <ReadableText kind="photoUrl">{value || "n/a"}</ReadableText>
    </View>
  );
}

function ReadableText({ children, kind }) {
  const textRef = useRef(null);
  const [pretextState, setPretextState] = useState({ status: "native", height: undefined, lineCount: 0 });

  useEffect(() => {
    if (Platform.OS !== "web" || !textRef.current) return undefined;
    let cancelled = false;
    const node = textRef.current;
    const measure = async () => {
      const width = Math.max(1, Math.floor(node.clientWidth || node.getBoundingClientRect?.().width || 0));
      const text = stringifyReadable(children);
      if (!width || !text) {
        setPretextState({ status: "empty", height: undefined, lineCount: 0 });
        return;
      }
      try {
        const result = await measureWithPretext(text, width, kind);
        if (!cancelled) setPretextState({ status: "ready", height: result.height, lineCount: result.lineCount });
      } catch {
        if (!cancelled) setPretextState({ status: "fallback", height: undefined, lineCount: 0 });
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return () => { cancelled = true; };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [children, kind]);

  if (Platform.OS === "web") {
    return React.createElement(
      "div",
      {
        ref: textRef,
        tabIndex: 0,
        "data-pretext-status": pretextState.status,
        "data-pretext-lines": pretextState.lineCount,
        style: readableWebStyle(kind, pretextState)
      },
      children
    );
  }

  const textStyle = kind === "surfaceTitle" ? styles.surfaceTitle
    : kind === "photoCaption" ? styles.photoCaption
      : kind === "photoUrl" ? styles.photoUrl
        : kind === "error" ? styles.errorText
          : styles.messageText;
  return <Text style={textStyle}>{children}</Text>;
}

async function measureWithPretext(text, width, kind) {
  if (isPretextFallbackForced()) throw new Error("Pretext fallback forced");
  if (typeof Intl === "undefined" || typeof Intl.Segmenter === "undefined") {
    throw new Error("Intl.Segmenter unavailable");
  }
  if (typeof document === "undefined" || !document.createElement("canvas").getContext("2d")) {
    throw new Error("Canvas 2D unavailable");
  }
  const { prepare, layout } = await import("@chenglou/pretext");
  const lineHeight = pretextLineHeight(kind);
  const prepared = prepare(text, pretextFont(kind), {
    whiteSpace: "pre-wrap",
    wordBreak: "keep-all",
    letterSpacing: 0
  });
  return layout(prepared, width, lineHeight);
}

function isPretextFallbackForced() {
  if (typeof window === "undefined") return false;
  if (window.__OBA_DISABLE_PRETEXT__) return true;
  try {
    return new URLSearchParams(window.location.search).has("pretextFallback");
  } catch {
    return false;
  }
}

function pretextFont(kind) {
  if (kind === "surfaceTitle") return '700 18px "Avenir Next", "Helvetica Neue", sans-serif';
  if (kind === "photoCaption") return '600 14px "Avenir Next", "Helvetica Neue", sans-serif';
  if (kind === "photoUrl") return '12px "Avenir Next", "Helvetica Neue", sans-serif';
  return '14px "Avenir Next", "Helvetica Neue", sans-serif';
}

function pretextLineHeight(kind) {
  if (kind === "surfaceTitle") return 24;
  if (kind === "photoUrl") return 17;
  return 20;
}

function stringifyReadable(value) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return Array.isArray(value) ? value.join("") : String(value || "");
}

function readableWebStyle(kind, pretextState) {
  if (kind === "surfaceTitle") {
    return baseReadableWebStyle({ color: "#111827", fontSize: 18, fontWeight: 700, lineHeight: "24px" }, pretextState);
  }
  if (kind === "photoCaption") {
    return baseReadableWebStyle({ color: "#111827", fontSize: 14, fontWeight: 600, lineHeight: "20px" }, pretextState);
  }
  if (kind === "photoUrl") {
    return baseReadableWebStyle({ color: "#374151", fontSize: 12, lineHeight: "17px", overflowWrap: "anywhere" }, pretextState);
  }
  if (kind === "error") {
    return baseReadableWebStyle({ color: "#991b1b", fontSize: 14, lineHeight: "20px", overflowWrap: "anywhere" }, pretextState);
  }
  return baseReadableWebStyle({ color: "#111827", fontSize: 14, lineHeight: "20px", overflowWrap: "anywhere" }, pretextState);
}

function baseReadableWebStyle(overrides, pretextState) {
  return {
    display: "block",
    flex: "0 1 auto",
    flexGrow: 0,
    flexShrink: 1,
    minHeight: 0,
    margin: 0,
    minHeight: pretextState?.height,
    whiteSpace: "pre-wrap",
    fontFamily: '"Avenir Next", "Helvetica Neue", sans-serif',
    letterSpacing: 0,
    ...overrides
  };
}

function ErrorNotice({ message }) {
  if (Platform.OS === "web") {
    return React.createElement(
      "div",
      {
        role: "alert",
        tabIndex: 0,
        style: {
          backgroundColor: "#fef2f2",
          borderColor: "#b91c1c",
          borderRadius: 8,
          borderStyle: "solid",
          borderWidth: 1,
          color: "#991b1b",
          fontSize: 13,
          padding: "8px 10px"
        }
      },
      message
    );
  }

  return (
    <View style={styles.errorStrip}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function ActionButton({ label, loading = false, onPress, variant, testID }) {
  if (Platform.OS === "web") {
    return React.createElement(
      "button",
      {
        type: "button",
        disabled: loading,
        onClick: onPress,
        "data-testid": testID,
        style: webButtonStyle(variant, loading)
      },
      loading ? "Loading..." : label
    );
  }

  const buttonStyle = variant === "hold" ? styles.holdButton
    : variant === "confirm" ? styles.confirmButton
      : variant === "toggleOn" ? styles.toggleOnButton
        : variant === "toggleOff" ? styles.toggleOffButton
          : variant === "recording" ? styles.recordingButton
      : variant === "quiet" ? styles.quietButton
        : [styles.primaryButton, loading && styles.buttonDisabled];
  const textStyle = variant === "hold"
    || variant === "quiet"
    || variant === "toggleOn"
    || variant === "toggleOff"
    || variant === "recording"
    ? styles.holdButtonText
    : styles.buttonText;

  return (
    <Pressable style={buttonStyle} onPress={onPress} disabled={loading} testID={testID}>
      {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={textStyle}>{label}</Text>}
    </Pressable>
  );
}

function webButtonStyle(variant, loading) {
  const base = {
    borderRadius: 8,
    borderStyle: "solid",
    cursor: loading ? "default" : "pointer",
    flex: variant === "primary" ? undefined : 1,
    fontFamily: '"Avenir Next", "Helvetica Neue", sans-serif',
    fontSize: 14,
    fontWeight: 600,
    minHeight: 40,
    opacity: loading ? 0.75 : 1,
    padding: "10px 12px"
  };
  if (variant === "recording") {
    return {
      ...base,
      backgroundColor: "#fee2e2",
      borderColor: "#dc2626",
      borderWidth: 1,
      color: "#7f1d1d"
    };
  }
  if (variant === "hold" || variant === "quiet") {
    return {
      ...base,
      backgroundColor: "#eef2ff",
      borderColor: "#6366f1",
      borderWidth: 1,
      color: "#312e81"
    };
  }
  if (variant === "confirm") {
    return {
      ...base,
      backgroundColor: "#0f766e",
      borderColor: "#0f766e",
      borderWidth: 1,
      color: "#ffffff"
    };
  }
  if (variant === "toggleOn" || variant === "toggleOff") {
    return {
      ...base,
      backgroundColor: variant === "toggleOn" ? "#e0f2fe" : "#f8fafc",
      borderColor: variant === "toggleOn" ? "#0284c7" : "#94a3b8",
      borderWidth: 1,
      color: variant === "toggleOn" ? "#0c4a6e" : "#334155"
    };
  }
  return {
    ...base,
    backgroundColor: "#1f6feb",
    borderColor: "#1f6feb",
    borderWidth: 1,
    color: "#ffffff"
  };
}

function createMessage(role, text, kind = "message", extra = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    kind,
    ...extra
  };
}

function extractTurnAnswer(body) {
  if (typeof body?.answer === "string" && body.answer.trim()) return body.answer.trim();
  if (typeof body?.message?.content === "string" && body.message.content.trim()) {
    return body.message.content.trim();
  }
  return JSON.stringify(body);
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error || "unknown error");
}

function compactJson(value) {
  if (!value || (Array.isArray(value) && value.length === 0)) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function stringifyValue(value) {
  if (typeof value === "string") return value;
  return compactJson(value);
}

function normalizeSurface(surface) {
  if (!surface || typeof surface !== "object") {
    return SAMPLE_SURFACE;
  }
  if (surface.kind === "comparisonTable" && Array.isArray(surface.columns) && Array.isArray(surface.items)) {
    return {
      kind: "comparisonTable",
      type: surface.type || "comparison.table",
      title: typeof surface.title === "string" ? surface.title : "",
      columns: surface.columns.map((column) => ({
        key: typeof column?.key === "string" ? column.key : "",
        label: typeof column?.label === "string" ? column.label : String(column?.key || "")
      })).filter((column) => column.key),
      items: surface.items.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    };
  }
  const images = surface.images;
  if (surface.kind !== "imageGallery" || !Array.isArray(images)) {
    return SAMPLE_SURFACE;
  }
  return {
    kind: "imageGallery",
    type: surface.type || "image.gallery",
    title: typeof surface.title === "string" && surface.title.trim()
      ? surface.title.trim()
      : SAMPLE_SURFACE.title,
    sourceUrl: typeof surface.sourceUrl === "string" ? surface.sourceUrl : "",
    images: images.map((photo) => ({
      url: typeof photo?.url === "string" ? photo.url : "",
      caption: typeof photo?.caption === "string" ? photo.caption : "",
      source: typeof photo?.source === "string" ? photo.source : ""
    })).filter((photo) => photo.url)
  };
}

function normalizeOptionalSurfaces(attachments, fallbackSurface) {
  if (Array.isArray(attachments)) {
    return attachments.map((surface) => normalizeSurface(surface));
  }
  if (fallbackSurface) return [normalizeSurface(fallbackSurface)];
  return [];
}

function isFakeMicrophoneEnabled() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("fakeMic");
  } catch {
    return false;
  }
}

function isDeniedMicrophoneSimulated() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("denyMic");
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef1f5"
  },
  container: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 980,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 8
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: "#111827"
  },
  gatewayBar: {
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 8
  },
  gatewayInput: {
    minHeight: 38
  },
  panel: {
    backgroundColor: "#ffffff",
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8
  },
  chatPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#b8c2d1",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    gap: 8
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827"
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  input: {
    borderColor: "#9ca3af",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    fontSize: 14,
    fontFamily: "Avenir Next"
  },
  messageInput: {
    minHeight: 48,
    maxHeight: 132,
    textAlignVertical: "top"
  },
  messageList: {
    gap: 8
  },
  messageBubble: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 4
  },
  userBubble: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderWidth: 1
  },
  assistantBubble: {
    backgroundColor: "#f8fafc",
    borderColor: "#d1d5db",
    borderWidth: 1
  },
  messageRole: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569"
  },
  messageText: {
    color: "#111827",
    fontSize: 14,
    lineHeight: 20
  },
  chatActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  statusPill: {
    flex: 1,
    minWidth: 160,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  statusOnline: {
    backgroundColor: "#ecfdf5",
    borderColor: "#10b981"
  },
  statusOffline: {
    backgroundColor: "#fff7ed",
    borderColor: "#f97316"
  },
  statusName: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "700"
  },
  statusText: {
    color: "#374151",
    fontSize: 12
  },
  primaryButton: {
    backgroundColor: "#1f6feb",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  quietButton: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  toggleOnButton: {
    backgroundColor: "#e0f2fe",
    borderColor: "#0284c7",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  toggleOffButton: {
    backgroundColor: "#f8fafc",
    borderColor: "#94a3b8",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  recordingButton: {
    backgroundColor: "#fee2e2",
    borderColor: "#dc2626",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonDisabled: {
    opacity: 0.75
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600"
  },
  errorStrip: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b91c1c",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  errorText: {
    color: "#991b1b",
    fontSize: 13
  },
  surfaceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827"
  },
  linkText: {
    color: "#1d4ed8",
    fontSize: 13
  },
  photoList: {
    gap: 8
  },
  inlineSurface: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    gap: 6
  },
  photoCard: {
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    overflow: "hidden"
  },
  photoImage: {
    width: "100%",
    height: 128,
    backgroundColor: "#e5e7eb"
  },
  photoMeta: {
    padding: 10,
    gap: 4
  },
  photoCaption: {
    fontSize: 14,
    color: "#111827",
    fontWeight: "600"
  },
  photoUrl: {
    fontSize: 12,
    color: "#374151"
  },
  photoSource: {
    fontSize: 12,
    color: "#4b5563"
  },
  tableSurface: {
    borderColor: "#d1d5db",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#ffffff"
  },
  tableRow: {
    flexDirection: "row",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1
  },
  tableHeader: {
    flex: 1,
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  tableCell: {
    flex: 1,
    color: "#374151",
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 7
  },
  noticeText: {
    fontSize: 13,
    color: "#374151"
  },
  confirmationStatus: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827"
  },
  confirmActions: {
    flexDirection: "row",
    gap: 8
  },
  confirmButton: {
    flex: 1,
    backgroundColor: "#0f766e",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center"
  },
  holdButton: {
    flex: 1,
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center"
  },
  debugPanel: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
    paddingTop: 6,
    gap: 4
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a"
  },
  debugLine: {
    fontSize: 12,
    color: "#334155"
  },
  debugBlock: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2
  },
  debugLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155"
  },
  holdButtonText: {
    color: "#312e81",
    fontWeight: "600",
    fontSize: 14
  }
});
