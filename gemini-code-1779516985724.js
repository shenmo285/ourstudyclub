// 【請將這裡替換成你在 Firebase Console 拿到的設定】
const firebaseConfig = {
  apiKey: "AIzaSyCPZydHo-ytzZJGJOBBqbHcGxg15PtYwYc",
  authDomain: "study-club-62fbc.firebaseapp.com",
  databaseURL: "https://study-club-62fbc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "study-club-62fbc",
  storageBucket: "study-club-62fbc.firebasestorage.app",
  messagingSenderId: "193634994633",
  appId: "1:193634994633:web:d32080ffecea58b4f90018",
  measurementId: "G-GX222PKEFR"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 狀態管理
let currentRoomId = null;
let roomData = null;
let currentView = { level: 'year', month: null, week: null, day: null };
let isLowBatteryMode = false;

// DOM 元素
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const contentArea = document.getElementById('content-area');
const messageEl = document.getElementById('auth-message');

// 檢查網址是否有房間 ID (?room=xxx)
window.onload = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get('room');
  if (roomId) {
    document.getElementById('room-name').value = roomId;
    document.getElementById('room-name').disabled = true;
    document.getElementById('auth-title').innerText = "加入讀書房間 🏡";
  }
};

// 進入房間邏輯
document.getElementById('auth-btn').addEventListener('click', async () => {
  const roomName = document.getElementById('room-name').value.trim();
  const password = document.getElementById('room-password').value;

  if (!roomName || !password) {
    showMessage('房間名稱跟密碼都要填寫喔 🥺');
    return;
  }

  const roomRef = db.collection('rooms').doc(roomName);
  const doc = await roomRef.get();

  if (doc.exists) {
    // 房間存在，檢查密碼
    if (doc.data().password === password) {
      enterRoom(roomName);
    } else {
      showMessage('好像不是這個密碼耶，再試一次看看 ✨');
    }
  } else {
    // 建立新房間，加入預設任務空陣列
    await roomRef.set({ password: password, tasks: [] });
    showMessage('房間建立成功！準備進入... 🎉');
    setTimeout(() => enterRoom(roomName), 1000);
  }
});

function showMessage(msg) {
  messageEl.innerText = msg;
  setTimeout(() => messageEl.innerText = '', 3000);
}

// 進入房間並建立即時監聽
function enterRoom(roomId) {
  currentRoomId = roomId;
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  document.getElementById('current-room-name').innerText = `🏡 ${roomId}`;

  // 更新網址方便分享
  window.history.replaceState(null, null, `?room=${roomId}`);

  // 【即時同步核心】監聽資料庫變化
  db.collection('rooms').doc(roomId).onSnapshot((doc) => {
    roomData = doc.data();
    if(!roomData.tasks) roomData.tasks = [];
    renderCurrentView(); // 資料一變動，自動重新渲染畫面
  });
}

// 分享網址
document.getElementById('share-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href);
  alert('網址已經複製囉！快去貼給朋友吧 ✨');
});

// 渲染畫面路由
function renderCurrentView() {
  contentArea.innerHTML = ''; // 清空內容
  updateBreadcrumb();
  updateEncouragement();

  if (isLowBatteryMode) {
    renderLowBatteryMode();
    return;
  }

  if (currentView.level === 'year') renderYearView();
  else if (currentView.level === 'month') renderMonthView();
  else if (currentView.level === 'week') renderWeekView();
  else if (currentView.level === 'day') renderDayView();
}

// 計算進度 (完成任務 / 總任務)
function getProgress(filterFn) {
  if (!roomData || !roomData.tasks) return 0;
  const filteredTasks = roomData.tasks.filter(filterFn);
  if (filteredTasks.length === 0) return 0;
  const completed = filteredTasks.filter(t => t.done).length;
  return Math.round((completed / filteredTasks.length) * 100);
}

// 渲染【年計畫】(簡化為顯示 1~3 月作為 MVP 範例)
function renderYearView() {
  const totalProgress = getProgress(() => true);
  
  let html = `
    <div class="card" style="margin-bottom: 20px;">
      <h3>2026 總體進度：${totalProgress}%</h3>
      <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${totalProgress}%"></div></div>
    </div>
  `;

  // 產生 1 到 3 月的卡片
  [1, 2, 3].forEach(m => {
    const p = getProgress(t => t.month === m);
    html += `
      <div class="list-item" onclick="navigate('month', ${m})">
        <span>【${m} 月】</span>
        <div style="display:flex; align-items:center; gap:10px;">
          <span>${p}%</span>
          <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${p}%"></div></div>
        </div>
      </div>
    `;
  });
  contentArea.innerHTML = html;
}

// 渲染【月計畫】
function renderMonthView() {
  const m = currentView.month;
  let html = `<h3>${m} 月讀書計畫</h3><p style="color:#888; margin-bottom:15px;">本月主線：一點一滴累積🌱</p>`;
  
  [1, 2, 3, 4].forEach(w => {
    const p = getProgress(t => t.month === m && t.week === w);
    html += `
      <div class="list-item" onclick="navigate('week', ${m}, ${w})">
        <span>第 ${w} 週</span>
        <span>${p}%</span>
      </div>
    `;
  });
  contentArea.innerHTML = html;
}

// 渲染【週計畫】
function renderWeekView() {
  const m = currentView.month;
  const w = currentView.week;
  let html = `<h3>第 ${w} 週</h3>`;
  
  // 簡化為顯示週一到週五
  ['週一', '週二', '週三', '週四', '週五'].forEach((dayName, idx) => {
    const d = idx + 1;
    const p = getProgress(t => t.month === m && t.week === w && t.day === d);
    html += `
      <div class="list-item" onclick="navigate('day', ${m}, ${w}, ${d}, '${dayName}')">
        <span>${dayName}</span>
        <span>${p}%</span>
      </div>
    `;
  });
  contentArea.innerHTML = html;
}

// 渲染【日計畫】(新增與勾選任務)
function renderDayView() {
  const { month, week, day } = currentView;
  const dayTasks = roomData.tasks.filter(t => t.month === month && t.week === week && t.day === day);
  const p = getProgress(t => t.month === month && t.week === week && t.day === day);

  let html = `
    <h3 style="margin-bottom:10px;">今日完成率：${p}%</h3>
    <div class="task-input-container">
      <input type="text" id="new-task-subject" placeholder="科目 (例: 生物)" style="flex: 1;">
      <input type="text" id="new-task-name" placeholder="任務 (例: 看影片)" style="flex: 2;">
      <button class="btn-primary" onclick="addTask()" style="width: auto; margin-top:0;">新增</button>
    </div>
    <div id="task-list"></div>
  `;
  contentArea.innerHTML = html;

  const taskList = document.getElementById('task-list');
  dayTasks.forEach(task => {
    const div = document.createElement('div');
    div.className = `task-item ${task.done ? 'completed' : ''}`;
    div.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask('${task.id}')">
      <div style="flex: 1;">
        <strong>${task.subject}</strong>：${task.name}
      </div>
      <button class="btn-outline" style="border:none; color: #ff8c8c; padding: 5px;" onclick="deleteTask('${task.id}')">刪除</button>
    `;
    taskList.appendChild(div);
  });
}

// 新增任務 (自動儲存)
async function addTask() {
  const subject = document.getElementById('new-task-subject').value;
  const name = document.getElementById('new-task-name').value;
  if (!subject || !name) return;

  const newTask = {
    id: Date.now().toString(), // 簡單產生唯一ID
    month: currentView.month,
    week: currentView.week,
    day: currentView.day,
    subject: subject,
    name: name,
    done: false
  };

  const updatedTasks = [...roomData.tasks, newTask];
  await db.collection('rooms').doc(currentRoomId).update({ tasks: updatedTasks });
}

// 切換任務狀態 (自動儲存)
async function toggleTask(taskId) {
  const updatedTasks = roomData.tasks.map(t => {
    if (t.id === taskId) return { ...t, done: !t.done };
    return t;
  });
  await db.collection('rooms').doc(currentRoomId).update({ tasks: updatedTasks });
}

// 刪除任務 (自動儲存)
async function deleteTask(taskId) {
  const updatedTasks = roomData.tasks.filter(t => t.id !== taskId);
  await db.collection('rooms').doc(currentRoomId).update({ tasks: updatedTasks });
}

// 導覽邏輯
function navigate(level, m = null, w = null, d = null, dayName = '') {
  currentView = { level, month: m || currentView.month, week: w || currentView.week, day: d || currentView.day, dayName };
  isLowBatteryMode = false;
  renderCurrentView();
}

document.querySelector('[data-level="year"]').addEventListener('click', () => navigate('year'));

function updateBreadcrumb() {
  document.getElementById('nav-month').className = currentView.level === 'year' ? 'hidden' : 'nav-item';
  document.getElementById('nav-week').className = (currentView.level === 'year' || currentView.level === 'month') ? 'hidden' : 'nav-item';
  document.getElementById('nav-day').className = currentView.level === 'day' ? 'nav-item' : 'hidden';

  if(currentView.month) document.getElementById('nav-month').innerText = `> ${currentView.month}月`;
  if(currentView.week) document.getElementById('nav-week').innerText = `> 第${currentView.week}週`;
  if(currentView.day) document.getElementById('nav-day').innerText = `> ${currentView.dayName || currentView.day}`;
}

// 動態鼓勵語錄
function updateEncouragement() {
  const msgBox = document.getElementById('encouragement-box');
  const msgs = [
    "太棒啦！今天也一起前進了一點點 ✨",
    "沒關係，慢慢來也算前進 🌱",
    "喝杯水休息一下，你已經做得很好了 🍵",
    "我們都在同一個房間裡陪你喔！加油 💛"
  ];
  msgBox.innerText = msgs[Math.floor(Math.random() * msgs.length)];
}

// 低電量模式
document.getElementById('low-battery-btn').addEventListener('click', () => {
  isLowBatteryMode = !isLowBatteryMode;
  renderCurrentView();
});

function renderLowBatteryMode() {
  contentArea.innerHTML = `
    <div class="card" style="background: var(--secondary);">
      <h2 style="color:white; margin-bottom: 10px;">🔋 今天只做一點點也沒關係模式</h2>
      <p style="color:white; margin-bottom: 20px;">累的時候，維持最低限度的手感就很棒了。</p>
      
      <div class="task-item"><input type="checkbox" class="task-checkbox"><div style="flex:1;">看教學影片 5 分鐘就好</div></div>
      <div class="task-item"><input type="checkbox" class="task-checkbox"><div style="flex:1;">背 5 個單字就好</div></div>
      <div class="task-item"><input type="checkbox" class="task-checkbox"><div style="flex:1;">把筆記翻開看 1 頁就好</div></div>
      
      <button class="btn-primary" style="background: white; color: var(--secondary);" onclick="isLowBatteryMode=false; renderCurrentView();">我充電完成了，回到一般模式 ✨</button>
    </div>
  `;
}