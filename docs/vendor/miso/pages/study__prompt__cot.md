---
title: "CoT"
source: "https://console.miso.gs/learn/study/prompt/cot"
synced_at: "2026-05-30"
nav_title: "CoT"
---

# CoT

Source: https://console.miso.gs/learn/study/prompt/cot

## Outline

- h1: CoT
  - h2: Chain of Thought - 생각의 사슬
  - h2: Zero-shot-CoT
  - h2: CoT 활용 전략

## Content

MISO 사용자 매뉴얼
>
미소 학습하기
>
프롬프트 작성 가이드
>
CoT
CoT
Chain of Thought - 생각의 사슬

아래는 CoT를 설명하는 아주 유명한 예시입니다.

Chain-of-Thought Prompting Elicits Reasoning in Large Language Models

일반적인 프롬프트에서 GenAI에게 로저는 테니스 공을 몇개 가지고 있고 몇 캔을 더 사고 각각의 캔에는 공이 몇개씩 들어있는데 그래서 로저는 현재 공을 몇개 가지고 있는지 간단한 논리문제의 예시와 정답을 GenAI에게 알려줍니다. 그리고 매우 비슷한 문제를 GenAI에게 제시하지만 GenAI는 이 문제를 풀지 못합니다. 하지만 동일한 문제에 대해서 풀이과정(생각의 사슬)을 설명해 주고 다시 문제를 물어보면 풀이과정(생각의 사슬)을 작성하면서 정답을 맞추게 됩니다. 이렇듯 GenAI가 작업을 분할하고 단계적으로 추론한 후 답변을 생성하도록 유도하는 프롬프팅 기법을 Chain of Thought라고 합니다.

Zero-shot-CoT
Large Language Models are Zero-Shot Reasoners

앞선 예시에서는 단순히 문제와 답만 보여주었을 때 GenAI가 문제를 풀지 못하였고 이를 해결하기 위해 문제와 문제를 해결하는 사고과정 그리고 정답을 한 세트로 보여주었습니다. 그리고 이런 기법을 CoT라고 하였습니다. 이번에는 문제를 푸는 사고 과정을 보여주지 않고 단순히 "Let's think step by step(단계별로 생각해 보자)."라고만 알려줍니다. 놀랍게도 GenAI에게 스스로 단계별로 생각해 보라는 지시만 내렸는데도 이전에는 풀지 못했던 문제를 푸는 것을 볼 수 있습니다.

CoT 활용 전략

GenAI에게 더 나은 답변을 얻기 위해서는, 우선 "단계별로 생각해서 답변해줘"라는 문장을 프롬프트에 추가해 보는 것이 효과적입니다. 이처럼 간단한 지시만으로도 GenAI는 스스로 사고의 흐름을 구성하며, 더 논리적이고 정확한 답변을 생성할 가능성이 높아집니다. 하지만 문제의 복잡성이 매우 높거나, 다단계 추론이 요구되는 경우에는 단순한 Zero-shot CoT만으로는 원하는 수준의 답변을 얻기 어려울 수 있습니다. 이럴 때는 사용자가 직접 사고의 흐름을 안내하는 형태로, 구체적인 단계별 Chain of Thought 프롬프트를 작성해주는 전략이 유용합니다. 즉, GenAI를 효과적으로 활용하려면 1단계로는 "Let's think step by step" 같은 간단한 사고 유도 프롬프트를 사용해보고, 2단계로는 그래도 결과가 부족하다면 사용자가 직접 사고 과정(CoT)을 설계하여 제시하는 방식으로 접근하는 것이 가장 바람직한 전략이라 할 수 있습니다.

Previous

Shot

Next

XML 형식으로 구조화하기

Last updated 26-0401-1500
