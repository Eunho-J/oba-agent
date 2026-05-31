---
title: "XML 형식으로 구조화하기"
source: "https://console.miso.gs/learn/study/prompt/xml"
synced_at: "2026-05-30"
nav_title: "XML 형식으로 구조화하기"
---

# XML 형식으로 구조화하기

Source: https://console.miso.gs/learn/study/prompt/xml

## Outline

- h1: XML 형식으로 구조화하기
  - h2: XML이란?

## Content

MISO 사용자 매뉴얼
>
미소 학습하기
>
프롬프트 작성 가이드
>
XML 형식으로 구조화하기
XML 형식으로 구조화하기
XML이란?

XML은 eXtensible Markup Language의 줄임말로, 쉽게 말해서 정보를 정리해서 담는 규칙 있는 문서 형식입니다.

예를 들어 우리가 어떤 음료수를 설명한다고 할 때, 이렇게 활용할 수 있습니다.

<음료수>
  <이름>오렌지 주스</이름>
  <용량>500ml</용량>
  <당도>중간</당도>
</음료수>

<이름>은 그 안에 음료 이름이 들어가고,
<용량>에는 얼마만큼 들어 있는지가,
<당도>에는 얼마나 단지에 대한 정보가 들어가죠.

즉, 정보에 "이게 뭔지"라는 이름표를 붙여서 보기 좋게 정리해주는 형식이라고 생각하시면 됩니다.

XML 양식은 웹사이트 개발 등에 많이 사용됩니다. GenAI는 인터넷 상의 웹문서, 코드, 마크업 언어(XML, HTML, JSON 등)를 대규모로 학습했습니다. 그 말은 곧, GenAI는 이런 구조를 "매우 자주, 매우 익숙하게" 접해왔다는 뜻입니다.

결과적으로 GenAI에게 XML 양식으로 설명(프롬프팅)하면 내용을 더 잘 이해할 가능성이 높아집니다.

아래와 같이 페르소나 기법에서 사용하였던 프롬프트를 수정해 볼 수 있습니다.

<Persona>
문진하는 의사
</Persona>

<Audience>
문진받는 환자
</Audience>

<Task>
환자를 문진한다
</Task>


복잡하고 긴 작업을 GenAI에게 명령하는 경우 위와 같이 XML 스타일로 프롬프트를 작성하는 것이 훨씬 효과가 좋을 가능성이 높습니다.

Previous

CoT

Next

예시 프롬프트 템플릿

Last updated 26-0401-1500
