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

1. [Netlify](https://app.netlify.com)에 로그인
2. "Add new site" → "Import an existing project" 선택
3. "Deploy with GitHub" 선택 후 저장소 연결
4. 저장소 선택: `youtubedownloader`
5. 브랜치 선택: `claude/youtube-downloader-site-014cCazTBzXbuCUyXFjs6qvs` (또는 원하는 브랜치)
6. 빌드 설정 확인:
   - Build command: (비워두기 - netlify.toml에서 자동 감지)
   - Publish directory: `.` (netlify.toml에서 자동 감지)
7. "Deploy" 클릭

**배포 후:**
- Netlify가 자동으로 랜덤 URL을 생성합니다 (예: `random-name-123.netlify.app`)
- Site settings → Domain management에서 사이트 이름을 원하는 대로 변경할 수 있습니다
- 예: `your-custom-name.netlify.app` (사용 가능한 경우)

**참고:**
- `youtubedownloader.netlify.app` 같은 일반적인 이름은 이미 사용 중일 수 있습니다
- 더 유니크한 이름을 선택하세요 (예: `yt-dl-yourname.netlify.app`)

### YouTube 접근 제한 해결 (선택사항)

YouTube의 봇 차단으로 인해 일부 비디오에서 403 Forbidden 에러가 발생할 수 있습니다. 이를 해결하려면 Netlify 환경 변수를 설정하세요:

#### 1. YouTube 쿠키 설정

1. Chrome에서 YouTube에 로그인
2. 개발자 도구 (F12) → Application → Cookies → https://www.youtube.com
3. 모든 쿠키를 복사 (특히 중요한 것: `__Secure-1PSID`, `__Secure-1PAPISID`, `__Secure-1PSIDTS`)
4. Netlify Dashboard → Site settings → Environment variables
5. 새 변수 추가:
   - **Key**: `YOUTUBE_COOKIES`
   - **Value**: `cookie1=value1; cookie2=value2; ...` (세미콜론으로 구분)

#### 2. PO Token 설정 (선택사항, 더 강력한 보안)

1. Chrome 확장 프로그램이나 스크립트로 `po_token`과 `visitor_data` 추출
2. Netlify 환경 변수 추가:
   - **Key**: `YOUTUBE_PO_TOKEN`
   - **Value**: 추출한 po_token 값
   - **Key**: `YOUTUBE_VISITOR_DATA`
   - **Value**: 추출한 visitor_data 값

**참고:**
- 쿠키는 주기적으로 만료되므로 정기적으로 업데이트해야 합니다
- 환경 변수 없이도 일부 비디오는 작동할 수 있습니다
- 쿠키 설정 후 사이트 재배포가 필요합니다

### 로컬 개발

```bash
# 의존성 설치
npm install

# 환경 변수 설정 (선택사항)
# .env 파일 생성
echo 'YOUTUBE_COOKIES="your_cookies_here"' > .env

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
