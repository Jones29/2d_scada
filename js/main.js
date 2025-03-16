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

// 初始化SCADA系统
async function initScadaSystem() {
    try {
        console.log('开始初始化SCADA系统...');
        let errorMessage = null;
        
        // 检查ScadaDataManager是否存在
        if (typeof ScadaDataManager === 'undefined') {
            errorMessage = '缺少ScadaDataManager组件，请检查是否正确加载了所有JavaScript文件';
            console.error(errorMessage);
            showBackendError(errorMessage);
            return;
        }
        
        // 获取数据管理器实例并初始化
        const dataManager = ScadaDataManager.getInstance();
        console.log('成功获取ScadaDataManager实例');
        
        // 显示加载中的提示
        const container = document.getElementById('scada-map');
        if (container) {
            container.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;color:#e0e0e0;">正在连接后台服务器，请稍候...</div>';
        }
        
        // 尝试初始化
        console.log('尝试连接到后台服务器...');
        const success = await dataManager.initialize();
        
        if (success) {
            console.log('后台连接成功，数据已加载');
            
            // 检查数据
            console.log('检查数据源是否包含车辆和路径...');
            const vehicles = dataManager.getAllVehicles();
            console.log('车辆数据:', vehicles);
            
            if (vehicles && vehicles.length > 0) {
                // 检查第一辆车是否包含path属性
                const firstVehicle = vehicles[0];
                console.log(`车辆 ${firstVehicle.id} 数据:`, firstVehicle);
                console.log(`车辆 ${firstVehicle.id} 是否有路径:`, !!firstVehicle.path);
                if (firstVehicle.path) {
                    console.log(`车辆 ${firstVehicle.id} 路径点数量:`, firstVehicle.path.length);
                }
            }
            
            // 清空加载提示
            if (container) container.innerHTML = '';
            
            // 初始化完成后，创建SCADA地图并传入数据管理器
            console.log('初始化SCADA地图...');
            window.scadaMap = new ScadaMap('scada-map');
            
            // 触发一个自定义事件通知其他组件
            console.log('触发scadaDataReady事件...');
            const event = new CustomEvent('scadaDataReady', { detail: dataManager });
            window.dispatchEvent(event);
            
            console.log('SCADA系统初始化完成，使用后台数据');
        } else {
            // 获取更详细的错误信息
            errorMessage = '无法连接到后台服务器，请检查网络连接或联系管理员';
            
            // 从数据管理器获取详细错误
            if (typeof dataManager.getLastError === 'function') {
                const detailedError = dataManager.getLastError();
                if (detailedError) {
                    errorMessage = detailedError;
                }
            }
            
            console.error('后台连接失败:', errorMessage);
            
            // 后台连接失败，显示错误信息
            showBackendError(errorMessage);
        }
    } catch (error) {
        console.error('SCADA系统初始化失败:', error);
        // 显示错误信息
        showBackendError(`SCADA系统初始化失败: ${error.message}`);
    }
}

// 显示后台连接错误
function showBackendError(message) {
    // 获取SCADA地图容器
    const container = document.getElementById('scada-map');
    if (!container) return;
    
    // 清空容器
    container.innerHTML = '';
    
    // 添加错误提示样式
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.backgroundColor = '#1a1f25';
    container.style.color = '#e0e0e0';
    container.style.padding = '20px';
    container.style.borderRadius = '5px';
    container.style.textAlign = 'center';
    
    // 创建错误图标
    const errorIcon = document.createElement('div');
    errorIcon.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f44336" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12" y2="16"></line>
        </svg>
    `;
    container.appendChild(errorIcon);
    
    // 创建错误标题
    const errorTitle = document.createElement('h2');
    errorTitle.textContent = '后台连接错误';
    errorTitle.style.margin = '10px 0';
    errorTitle.style.color = '#f44336';
    container.appendChild(errorTitle);
    
    // 创建错误消息
    const errorMessage = document.createElement('p');
    errorMessage.textContent = message;
    errorMessage.style.margin = '10px 0';
    errorMessage.style.maxWidth = '80%';
    container.appendChild(errorMessage);
    
    // 创建技术信息部分
    const techInfo = document.createElement('div');
    techInfo.style.marginTop = '15px';
    techInfo.style.padding = '10px';
    techInfo.style.backgroundColor = 'rgba(0,0,0,0.2)';
    techInfo.style.borderRadius = '4px';
    techInfo.style.fontSize = '12px';
    techInfo.style.color = '#aaa';
    techInfo.style.maxWidth = '80%';
    techInfo.style.textAlign = 'left';
    
    // 添加API地址信息
    techInfo.innerHTML = `
        <p>请检查以下内容:</p>
        <ul style="margin: 5px 0; padding-left: 20px;">
            <li>后台服务器是否已启动</li>
            <li>API 地址: <code>http://localhost:3000/api/scada/data</code></li>
            <li>网络连接是否正常</li>
            <li>防火墙是否阻止了连接</li>
        </ul>
    `;
    container.appendChild(techInfo);
    
    // 创建重试按钮
    const retryButton = document.createElement('button');
    retryButton.textContent = '重新连接';
    retryButton.style.marginTop = '20px';
    retryButton.style.padding = '10px 20px';
    retryButton.style.backgroundColor = '#2196f3';
    retryButton.style.color = 'white';
    retryButton.style.border = 'none';
    retryButton.style.borderRadius = '4px';
    retryButton.style.cursor = 'pointer';
    retryButton.onclick = () => {
        // 清空错误提示
        container.innerHTML = '';
        container.style = '';
        
        // 重新初始化SCADA系统
        initScadaSystem();
    };
    container.appendChild(retryButton);
    
    console.warn('后台连接错误:', message);
}

// 当页面加载完成后初始化SCADA系统
document.addEventListener('DOMContentLoaded', () => {
    // 初始化任务表格
    initTaskTable();
    
    // 初始化徽标
    initLogo();
    
    // 初始化SCADA系统
    initScadaSystem();
    
    // 定时刷新数据（模拟实时数据更新）
    setInterval(() => {
        // 这里可以添加实时数据更新逻辑
        // 例如通过API获取最新任务数据等
    }, 30000); // 每30秒刷新一次
}); 