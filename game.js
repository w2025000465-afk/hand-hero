
import {
  FilesetResolver,
  HandLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm";

// HTML 요소
const video = document.getElementById("camera");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreText = document.getElementById("score");
const timeText = document.getElementById("time");
const message = document.getElementById("message");
const startButton = document.getElementById("startButton");

// 게임 설정
canvas.width = 800;
canvas.height = 450;

let handLandmarker;
let score = 0;
let timeLeft = 60;
let gameRunning = false;
let gameTimer = null;
let lastPinching = false;

let cursor = { x: 400, y: 225 };
let handDetected = false;

let orb = {
  x: 200,
  y: 180,
  radius: 24
};

// 랜덤 위치에 구슬 생성
function createOrb() {
  orb.x = 50 + Math.random() * 700;
  orb.y = 50 + Math.random() * 350;
}

// AI 모델 준비
async function setupAI() {
  message.textContent = "AI 모델을 불러오는 중...";

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(
    vision,
    {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "CPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    }
  );
}

// 카메라 시작
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "user",
      width: 640,
      height: 480
    }
  });

  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = resolve;
  });

  await video.play();
}

// 게임 시작
async function startGame() {
  if (gameRunning) return;

  startButton.disabled = true;
  message.textContent = "게임을 준비하고 있어요!";

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("HTTPS 환경에서 실행해 주세요.");
    }

    if (!handLandmarker) {
      await setupAI();
    }

    await startCamera();

    score = 0;
    timeLeft = 60;
    lastPinching = false;

    scoreText.textContent = score;
    timeText.textContent = timeLeft;

    createOrb();

    gameRunning = true;
    message.textContent = "손을 카메라에 보여주세요!";

    gameTimer = setInterval(() => {
      timeLeft--;
      timeText.textContent = timeLeft;

      if (timeLeft <= 0) {
        finishGame();
      }
    }, 1000);

    requestAnimationFrame(gameLoop);

  } catch (error) {
    console.error(error);
    message.textContent =
      "오류: 카메라 권한과 인터넷 연결을 확인해 주세요.";
    startButton.disabled = false;
  }
}

// 게임 종료
function finishGame() {
  gameRunning = false;
  clearInterval(gameTimer);

  message.textContent =
    `게임 종료! 최종 점수는 ${score}점입니다!`;

  startButton.textContent = "다시 플레이";
  startButton.disabled = false;
}

// 손 인식
function detectHand() {
  if (!handLandmarker || video.readyState < 2) return;

  const results = handLandmarker.detectForVideo(
    video,
    performance.now()
  );

  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];

    // 검지 끝 좌표
    const indexFinger = landmarks[8];

    cursor.x = (1 - indexFinger.x) * canvas.width;
    cursor.y = indexFinger.y * canvas.height;

    // 엄지와 검지 사이 거리
    const thumb = landmarks[4];

    const dx = thumb.x - indexFinger.x;
    const dy = thumb.y - indexFinger.y;

    const distance = Math.sqrt(dx * dx + dy * dy);

    handDetected = true;

    // 집기 동작을 새로 시작한 순간 판정
    const pinching = distance < 0.055;

    if (pinching && !lastPinching) {
      collectOrb();
    }

    lastPinching = pinching;

  } else {
    handDetected = false;
    lastPinching = false;
  }
}

// 구슬 획득
function collectOrb() {
  const dx = cursor.x - orb.x;
  const dy = cursor.y - orb.y;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < orb.radius + 25) {
    score += 10;
    scoreText.textContent = score;

    createOrb();

    message.textContent = "✨ 구슬 획득! +10점";
  }
}

// 게임 화면 그리기
function drawGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 배경 별
  for (let i = 0; i < 45; i++) {
    const x = (i * 173) % canvas.width;
    const y = (i * 97) % canvas.height;

    ctx.fillStyle = "#7777bb";
    ctx.fillRect(x, y, 2, 2);
  }

  // 구슬
  const gradient = ctx.createRadialGradient(
    orb.x - 7, orb.y - 7, 2,
    orb.x, orb.y, orb.radius
  );

  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.35, "#67e8f9");
  gradient.addColorStop(1, "#7c3aed");

  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.shadowColor = "#67e8f9";
  ctx.shadowBlur = 25;
  ctx.fill();
  ctx.shadowBlur = 0;

  // 손 위치 표시
  if (handDetected) {
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 13, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#67e8f9";
    ctx.fill();
  }

  // 안내 문구
  if (!handDetected) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "22px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "카메라에 손을 보여주세요!",
      canvas.width / 2,
      canvas.height / 2
    );
  }
}

// 게임 반복 실행
function gameLoop() {
  if (!gameRunning) return;

  detectHand();
  drawGame();

  requestAnimationFrame(gameLoop);
}

// 버튼 연결
startButton.addEventListener("click", startGame);

// 초기 화면
drawGame();
