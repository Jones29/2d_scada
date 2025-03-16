// 更新时间显示
function updateTimeDisplay() {
    const timeDisplay = document.getElementById('time-display');
    const now = new Date();
    
    // 格式化日期和时间
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    // 更新显示
    timeDisplay.textContent = `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 初始化时间显示并每分钟更新一次
document.addEventListener('DOMContentLoaded', () => {
    updateTimeDisplay();
    
    // 每分钟更新一次
    setInterval(updateTimeDisplay, 60000);
}); 