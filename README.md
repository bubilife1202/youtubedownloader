# YouTube Downloader

유튜브 비디오 다운로드 링크를 제공하는 웹 애플리케이션입니다.

## 기술 스택

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Netlify Functions (Node.js)
- **라이브러리**: @distube/ytdl-core

## 주요 기능

- 유튜브 URL 입력으로 비디오 정보 조회
- 다양한 포맷/화질 옵션 제공
- 비디오 + 오디오, 비디오만, 오디오만 옵션 선택 가능
- 파일 크기 및 포맷 정보 표시
- 반응형 디자인

## 배포 방법

### Netlify에 배포하기

1. GitHub에 저장소 푸시
2. [Netlify](https://netlify.com)에 로그인
3. "New site from Git" 선택
4. GitHub 저장소 연결
5. 빌드 설정은 자동으로 감지됩니다 (netlify.toml 사용)
6. "Deploy site" 클릭

### 로컬 개발

```bash
# 의존성 설치
npm install

# 로컬 개발 서버 실행 (Netlify Dev)
npm run dev
```

## 프로젝트 구조

```
.
├── index.html                    # 프론트엔드 UI
├── netlify.toml                  # Netlify 설정
├── package.json                  # 프로젝트 의존성
└── netlify/
    └── functions/
        └── getVideo.js          # 비디오 정보 조회 API
```

## API 엔드포인트

### GET /api/getVideo

유튜브 비디오 정보를 조회합니다.

**쿼리 파라미터:**
- `url`: 유튜브 비디오 URL

**응답 예시:**
```json
{
  "success": true,
  "title": "비디오 제목",
  "thumbnail": "썸네일 URL",
  "author": "채널명",
  "lengthSeconds": "300",
  "viewCount": "1000000",
  "recommendedFormat": { ... },
  "formats": [ ... ]
}
```

## 주의사항

- 이 애플리케이션은 교육 목적으로만 사용하세요
- 저작권이 있는 콘텐츠의 무단 다운로드는 법적 문제가 될 수 있습니다
- YouTube의 서비스 약관을 준수하세요

## 라이선스

MIT
