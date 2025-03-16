// 任务数据
const taskData = [
    { id: 'UJ/1-09-29', name: '零件仓库搬运', amr: 'AMR-800K', status: '已完成', time: '09:13 09:39' },
    { id: 'UJ/1-09-30', name: 'AMR车辆运动', amr: 'AMR-800K', status: '已完成', time: '09:13 09:39' },
    { id: 'UJ/1-09-31', name: '质量室测试运动', amr: 'SFL-CD020', status: '已完成', time: '09:13 09:39' },
    { id: 'UJ/1-09-32', name: '物料载具搬运', amr: 'SFL-CD014', status: '已完成', time: '09:13 09:37' },
    { id: 'UJ/1-09-33', name: '质量室测试运动', amr: 'SFL-CD020', status: '已完成', time: '09:13 09:37' }
];

// 初始化任务表格
function initTaskTable() {
    const tableContainer = document.getElementById('task-table');
    
    // 创建表格元素
    const table = document.createElement('table');
    table.className = 'task-execution-table';
    
    // 创建表头
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // 表头列
    const headers = ['创建时间', '任务名称', 'AMR', '状态', '开始-结束'];
    
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // 创建表格主体
    const tbody = document.createElement('tbody');
    
    // 添加任务数据行
    taskData.forEach(task => {
        const row = document.createElement('tr');
        
        // 创建时间
        const timeCell = document.createElement('td');
        timeCell.textContent = task.id;
        row.appendChild(timeCell);
        
        // 任务名称
        const nameCell = document.createElement('td');
        nameCell.textContent = task.name;
        row.appendChild(nameCell);
        
        // AMR
        const amrCell = document.createElement('td');
        amrCell.textContent = task.amr;
        row.appendChild(amrCell);
        
        // 状态
        const statusCell = document.createElement('td');
        statusCell.textContent = task.status;
        // 根据状态设置颜色
        if (task.status === '已完成') {
            statusCell.style.color = '#3ddc84';
        } else if (task.status === '执行中') {
            statusCell.style.color = '#2196f3';
        } else if (task.status === '异常') {
            statusCell.style.color = '#f44336';
        }
        row.appendChild(statusCell);
        
        // 开始-结束时间
        const durationCell = document.createElement('td');
        durationCell.textContent = task.time;
        row.appendChild(durationCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    tableContainer.appendChild(table);
}

// 初始化徽标图像
function initLogo() {
    // 创建一个简单的logo作为示例
    const logoImg = document.querySelector('.logo img');
    if (logoImg) {
        logoImg.onerror = function() {
            // 如果logo加载失败，创建一个canvas元素作为备用
            const canvas = document.createElement('canvas');
            canvas.width = 120;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            
            // 绘制SEER文字
            ctx.fillStyle = '#3ddc84';
            ctx.font = 'bold 24px Arial';
            ctx.fillText('SEER', 10, 28);
            
            // 绘制副标题
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '10px Arial';
            ctx.fillText('仙工智能', 15, 38);
            
            // 替换图像
            const dataURL = canvas.toDataURL();
            this.src = dataURL;
        };
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化任务表格
    initTaskTable();
    
    // 初始化徽标
    initLogo();
    
    // 定时刷新数据（模拟实时数据更新）
    setInterval(() => {
        // 这里可以添加实时数据更新逻辑
        // 例如通过API获取最新任务数据等
    }, 30000); // 每30秒刷新一次
}); 