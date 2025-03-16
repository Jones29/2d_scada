class ScadaMap {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // 设置父容器样式
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.position = 'relative';
        this.container.style.overflow = 'hidden';
        this.container.style.display = 'block';
        
        this.app = null;
        this.mapScale = 1.0;
        this.minScale = 0.5;  // 最小缩放比例
        this.maxScale = 2.0;  // 最大缩放比例
        this.scaleStep = 0.1; // 每次缩放步长
        // 使用固定的地图尺寸
        this.mapSize = 800;
        this.amrList = [];
        this.pathPoints = {};
        this.stations = {};
        this.followingAmr = null;
        this.isDragging = false;  // 添加拖动状态
        this.dragStartX = 0;      // 添加拖动起始位置X
        this.dragStartY = 0;      // 添加拖动起始位置Y
        this.lastDragX = 0;       // 添加上次拖动位置X
        this.lastDragY = 0;       // 添加上次拖动位置Y
        this.dataManager = null;  // 数据管理器初始为null
        
        // 等待数据源加载完成后再初始化
        window.addEventListener('scadaDataReady', (event) => {
            this.dataManager = event.detail;
            this.init();
        });
    }
    
    // 初始化方法
    async init() {
        // 初始化PixiJS应用
        this.initPixiApp();
        
        // 添加地图元素
        this.drawFactoryMap();
        
        // 添加控制按钮
        this.addControlButtons();
        
        // 添加AMR和站点
        await this.setupStations();
        await this.setupAMRs();
        
        // 添加路径
        this.drawPaths();
        
        // 添加事件监听
        this.addEventListeners();
        
        // 开始动画循环
        this.animate();
    }
    
    // 初始化PixiJS应用
    initPixiApp() {
        // 获取父容器尺寸
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // 创建PixiJS应用
        this.app = new PIXI.Application({
            width: width,
            height: height,
            backgroundColor: 0x141920,
            resolution: window.devicePixelRatio || 1,
            antialias: true,
            autoDensity: true
        });
        
        // 设置画布样式
        this.app.view.style.position = 'absolute';
        this.app.view.style.top = '0';
        this.app.view.style.left = '0';
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        
        // 添加到容器
        this.container.appendChild(this.app.view);
        
        // 创建主场景和背景图层
        this.mapContainer = new PIXI.Container();
        this.pathContainer = new PIXI.Container();
        this.stationContainer = new PIXI.Container();
        this.amrContainer = new PIXI.Container();
        
        // 确保路径容器的可见性
        this.pathContainer.visible = true;
        this.pathContainer.alpha = 1;
        
        // 添加到舞台
        this.app.stage.addChild(this.mapContainer);
        this.app.stage.addChild(this.pathContainer);
        this.app.stage.addChild(this.stationContainer);
        this.app.stage.addChild(this.amrContainer);
        
        // 居中所有容器
        this.centerContainers();
        
        // 初始化时自动调整大小以适应容器
        this.resizeHandler();
        
        // 强制启用PIXI.js的自动渲染
        this.app.ticker.add(() => {
            this.app.renderer.render(this.app.stage);
        });
    }
    
    // 居中所有容器
    centerContainers() {
        const centerX = this.app.screen.width / 2;
        const centerY = this.app.screen.height / 2;
        
        [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
            container.position.set(centerX, centerY);
            container.pivot.set(0, 0); // 确保容器的原点在中心
        });
    }
    
    // 绘制工厂地图
    drawFactoryMap() {
        // 创建一个专门的区域容器
        this.areaContainer = new PIXI.Container();
        this.mapContainer.addChild(this.areaContainer);
        
        // 绘制工厂背景
        const factory = new PIXI.Graphics();
        factory.lineStyle(2, 0x3e4756, 1);
        factory.beginFill(0x1a1f25, 0.5);
        // 使用固定的地图尺寸，而不是容器尺寸
        const mapSize = 800; // 固定地图尺寸
        factory.drawRect(-mapSize / 2, -mapSize / 2, mapSize, mapSize);
        factory.endFill();
        this.mapContainer.addChild(factory);
        
        // 自动根据货位位置生成区域
        this.generateAreasFromLocations();
        
        // 绘制网格线
        const grid = new PIXI.Graphics();
        grid.lineStyle(1, 0x3e4756, 0.3);
        
        // 垂直线
        for (let x = -mapSize / 2; x <= mapSize / 2; x += 50) {
            grid.moveTo(x, -mapSize / 2);
            grid.lineTo(x, mapSize / 2);
        }
        
        // 水平线
        for (let y = -mapSize / 2; y <= mapSize / 2; y += 50) {
            grid.moveTo(-mapSize / 2, y);
            grid.lineTo(mapSize / 2, y);
        }
        
        this.mapContainer.addChild(grid);
        
        // 添加比例尺
        this.drawScale();
    }
    
    // 根据货位位置自动生成区域
    generateAreasFromLocations() {
        // 从数据源获取所有货位
        const locations = this.dataManager.getAllLocations();
        
        // 如果没有货位数据，则返回
        if (!locations || locations.length === 0) {
            console.warn("无法生成区域：没有货位数据");
            return;
        }
        
        // 按区域名称对货位进行分组
        const areaGroups = {};
        
        locations.forEach(location => {
            // 使用location.area字段作为区域名称
            // 如果没有area字段，则尝试从名称中提取
            const areaName = location.area || this.extractAreaName(location.name);
            
            if (!areaGroups[areaName]) {
                areaGroups[areaName] = [];
            }
            
            areaGroups[areaName].push(location);
        });
        
        // 为每个区域计算边界并绘制
        Object.keys(areaGroups).forEach(areaName => {
            const areaLocations = areaGroups[areaName];
            
            // 至少需要一个货位才能定义区域
            if (areaLocations.length > 0) {
                // 计算区域的边界框
                const bounds = this.calculateAreaBounds(areaLocations);
                
                // 添加一些边距
                const padding = 30;
                bounds.minX -= padding;
                bounds.minY -= padding;
                bounds.maxX += padding;
                bounds.maxY += padding;
                
                // 计算宽度和高度
                const width = bounds.maxX - bounds.minX;
                const height = bounds.maxY - bounds.minY;
                
                // 获取区域的中文名称
                const displayName = this.getAreaDisplayName(areaName);
                
                // 绘制区域
                this.drawArea(bounds.minX, bounds.minY, width, height, 0x2b323c, displayName);
            }
        });
    }
    
    // 获取区域的中文名称
    getAreaDisplayName(areaName) {
        switch (areaName) {
            case 'FACTORY-A':
                return '工厂A';
            case 'FACTORY-B':
                return '工厂B';
            case 'STORAGE':
                return '存储区';
            default:
                return areaName;
        }
    }
    
    // 从货位名称中提取区域名称
    extractAreaName(locationName) {
        // 默认使用 "-" 分隔，取第一部分作为区域名称
        // 例如：从 "FACTORY-A-01" 提取 "FACTORY-A"
        const parts = locationName.split('-');
        
        if (parts.length >= 2) {
            return `${parts[0]}-${parts[1]}`;
        }
        
        // 如果没有 "-"，则返回原名称
        return locationName;
    }
    
    // 计算区域边界
    calculateAreaBounds(locations) {
        // 初始化边界值
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        
        // 遍历所有货位找出最小和最大坐标
        locations.forEach(location => {
            const x = location.coordinates.x;
            const y = location.coordinates.y;
            
            // 更新边界值
            minX = Math.min(minX, x - 40); // 考虑货位宽度
            minY = Math.min(minY, y - 40); // 考虑货位高度
            maxX = Math.max(maxX, x + 40);
            maxY = Math.max(maxY, y + 40);
        });
        
        return { minX, minY, maxX, maxY };
    }
    
    // 绘制区域
    drawArea(x, y, width, height, color, name) {
        const area = new PIXI.Graphics();
        area.lineStyle(2, 0x3e4756, 1);
        area.beginFill(color, 0.3); // 降低透明度，避免完全遮挡货位
        area.drawRect(x, y, width, height);
        area.endFill();
        
        // 添加区域名称
        const text = new PIXI.Text(name, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xe0e0e0,
            align: 'center'
        });
        text.position.set(x + width / 2 - text.width / 2, y + 10);
        
        // 使用专门的区域容器
        this.areaContainer.addChild(area);
        this.areaContainer.addChild(text);
    }
    
    // 绘制比例尺
    drawScale() {
        const scaleContainer = new PIXI.Container();
        scaleContainer.name = 'scale';

        // 使用固定的比例尺长度
        const baseLength = 50; // 基准长度（米）
        const pixelsPerMeter = 1; // 1像素代表1米
        const scaleLength = baseLength * pixelsPerMeter;
        
        const scale = new PIXI.Graphics();
        scale.lineStyle(2, 0xe0e0e0, 1);
        scale.moveTo(-scaleLength/2, 250);
        scale.lineTo(scaleLength/2, 250);
        
        const text = new PIXI.Text(`${baseLength} m`, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: 0xe0e0e0,
            align: 'center'
        });
        text.position.set(-text.width / 2, 260);
        
        scaleContainer.addChild(scale);
        scaleContainer.addChild(text);
        this.mapContainer.addChild(scaleContainer);
    }
    
    // 设置站点
    async setupStations() {
        try {
            // 从数据源获取货位数据
            let locations = [];
            if (typeof this.dataManager.getAllLocations === 'function') {
                // 处理异步和同步两种情况
                if (this.dataManager.getAllLocations.constructor.name === 'AsyncFunction') {
                    locations = await this.dataManager.getAllLocations();
                } else {
                    locations = this.dataManager.getAllLocations();
                }
            }
            
            // 如果没有获取到货位数据，显示警告并退出
            if (!locations || locations.length === 0) {
                console.warn("无法获取货位数据");
                return;
            }
            
            // 遍历所有货位创建站点
            for (const location of locations) {
                await this.createStation(
                    location.id,
                    location.coordinates.x,
                    location.coordinates.y,
                    location.name
                );
            }
        } catch (error) {
            console.error("设置站点时发生错误:", error);
        }
    }
    
    // 创建单个站点
    async createStation(id, x, y, name) {
        const station = new PIXI.Container();
        station.position.set(x, y);
        
        // 获取货位对象以获取状态和容量信息
        let location = null;
        if (typeof this.dataManager.getLocationById === 'function') {
            // 处理异步和同步两种情况
            if (this.dataManager.getLocationById.constructor.name === 'AsyncFunction') {
                location = await this.dataManager.getLocationById(id);
            } else {
                location = this.dataManager.getLocationById(id);
            }
        }
        
        const status = location ? location.status : 'empty';
        const capacity = location ? location.currentCapacity : 0;
        const maxCapacity = location ? location.maxCapacity : 1000;
        
        // 获取区域信息并转换为显示名称
        const area = location ? location.area : '';
        const displayName = this.getLocationDisplayName(id, area);
        
        // 绘制站点图标 - 使用更大的矩形表示货位
        const icon = new PIXI.Graphics();
        
        // 根据状态设置颜色
        let fillColor;
        switch (status) {
            case 'empty':
                fillColor = 0x1a1f25; // 深蓝灰色
                break;
            case 'occupied':
                // 根据容量百分比设置颜色深浅
                const fillRatio = capacity / maxCapacity;
                const r = Math.floor(45 + fillRatio * 210); // 从深蓝到浅蓝
                const g = Math.floor(80 + fillRatio * 175);
                const b = Math.floor(130 + fillRatio * 125);
                fillColor = (r << 16) | (g << 8) | b;
                break;
            case 'maintenance':
                fillColor = 0xf44336; // 红色
                break;
            default:
                fillColor = 0x1a1f25;
        }
        
        // 绘制货位
        icon.lineStyle(2, 0x2196f3, 1);
        icon.beginFill(fillColor, 0.8);
        icon.drawRect(-40, -40, 80, 80);
        icon.endFill();
        
        // 添加货位ID
        const text = new PIXI.Text(id, {
            fontFamily: 'Arial',
            fontSize: 14,
            fill: 0x2196f3,
            align: 'center'
        });
        text.position.set(-text.width / 2, -text.height / 2);
        
        // 添加中文标签
        const nameText = new PIXI.Text(displayName, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xffffff,
            align: 'center'
        });
        nameText.position.set(-nameText.width / 2, -60);
        
        // 添加状态文本
        const statusText = new PIXI.Text(this.getStatusText(status), {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: 0xe0e0e0,
            align: 'center'
        });
        statusText.position.set(-statusText.width / 2, 20);
        
        // 添加容量信息
        const capacityText = new PIXI.Text(`${capacity}/${maxCapacity}`, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: 0xe0e0e0,
            align: 'center'
        });
        capacityText.position.set(-capacityText.width / 2, -30);
        
        station.addChild(icon);
        station.addChild(text);
        station.addChild(statusText);
        station.addChild(capacityText);
        station.addChild(nameText);
        
        // 添加交互
        station.eventMode = 'static';
        station.cursor = 'pointer';
        
        station.on('mouseover', () => {
            icon.tint = 0x64b5f6;
        });
        
        station.on('mouseout', () => {
            icon.tint = 0xffffff;
        });
        
        // 保存原始数据，用于更新
        station.locationData = {
            id,
            name,
            status,
            capacity,
            maxCapacity,
            area
        };
        
        this.stationContainer.addChild(station);
        this.stations[id] = station;
    }
    
    // 获取货位的显示名称
    getLocationDisplayName(id, area) {
        // 从ID解析编号部分
        let number = id;
        
        // 如果ID类似于"L1"，提取数字部分
        if (id.match(/^[A-Za-z]+\d+$/)) {
            number = id.match(/\d+/)[0];
        }
        
        // 根据区域返回相应的中文名称
        if (area === 'FACTORY-A') {
            return `货位${number}`;
        } else if (area === 'FACTORY-B') {
            return `货位${number}`;
        } else if (area === 'STORAGE') {
            return `货位${number}`;
        }
        
        // 默认返回
        return `货位${number}`;
    }
    
    // 获取状态的中文文本
    getStatusText(status) {
        switch(status) {
            case 'empty':
                return '空闲';
            case 'occupied':
                return '占用';
            case 'maintenance':
                return '维护';
            default:
                return status.toUpperCase();
        }
    }
    
    // 设置AMR
    async setupAMRs() {
        try {
            // 从数据源获取车辆数据
            let vehicles = [];
            if (typeof this.dataManager.getAllVehicles === 'function') {
                // 处理异步和同步两种情况
                if (this.dataManager.getAllVehicles.constructor.name === 'AsyncFunction') {
                    vehicles = await this.dataManager.getAllVehicles();
                } else {
                    vehicles = this.dataManager.getAllVehicles();
                }
            }
            
            // 如果没有获取到车辆数据，显示警告并退出
            if (!vehicles || vehicles.length === 0) {
                console.warn("无法获取车辆数据");
                return;
            }
            
            // 遍历所有车辆创建AMR
            for (const vehicle of vehicles) {
                this.createAMR({
                    id: vehicle.id,
                    x: vehicle.position.x,
                    y: vehicle.position.y,
                    state: vehicle.status,
                    speed: 0, // 初始速度设为0
                    path: [] // 初始路径为空
                });
            }
        } catch (error) {
            console.error("设置AMR时发生错误:", error);
        }
    }
    
    // 创建AMR
    createAMR(data) {
        const amr = new PIXI.Container();
        amr.position.set(data.x, data.y);
        
        // 为AGV生成随机颜色 (避免太暗或太亮的颜色)
        let randomColor;
        if (data.color) {
            randomColor = data.color;
        } else {
            const r = Math.floor(100 + Math.random() * 155);
            const g = Math.floor(100 + Math.random() * 155);
            const b = Math.floor(100 + Math.random() * 155);
            randomColor = (r << 16) | (g << 8) | b;
        }
        
        // AMR主体
        const body = new PIXI.Graphics();
        body.lineStyle(2, randomColor, 1);  // 使用随机颜色作为边线
        body.beginFill(0x1a1f25, 0.8);
        body.drawRect(-20, -15, 40, 30);
        body.endFill();
        
        // 添加AMR ID
        const text = new PIXI.Text(data.id, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: randomColor,  // 使用随机颜色作为文字颜色
            align: 'center'
        });
        text.position.set(-text.width / 2, -25);
        
        // 状态指示器
        const statusIndicator = new PIXI.Graphics();
        statusIndicator.beginFill(this.getStatusColor(data.state));
        statusIndicator.drawCircle(15, -10, 3);
        statusIndicator.endFill();
        
        amr.addChild(body);
        amr.addChild(text);
        amr.addChild(statusIndicator);
        
        // 添加交互
        amr.eventMode = 'static';
        amr.cursor = 'pointer';
        
        // 保存AMR数据和颜色
        data.color = randomColor; // 将颜色保存到数据对象中
        amr.data = data;
        
        // 添加鼠标事件
        amr.on('mouseover', () => {
            body.tint = 0x64dd98;
            const localPos = amr.position;
            const globalPos = this.amrContainer.toGlobal(localPos);
            this.showAmrDetails(data, globalPos.x, globalPos.y);
        });
        
        amr.on('mouseout', () => {
            body.tint = 0xffffff;
            this.hideAmrDetails();
        });
        
        amr.on('click', () => {
            if (this.followingAmr === data.id) {
                this.followingAmr = null;
            } else {
                this.followingAmr = data.id;
            }
        });
        
        this.amrContainer.addChild(amr);
        this.amrList.push(amr);
    }
    
    // 获取状态颜色
    getStatusColor(state) {
        switch (state) {
            case 'idle':
                return 0x3ddc84; // 绿色
            case 'running':
                return 0x2196f3; // 蓝色
            case 'error':
                return 0xf44336; // 红色
            default:
                return 0xe0e0e0; // 灰色
        }
    }
    
    // 显示AMR详情
    showAmrDetails(data, x, y) {
        // 如果已有详情框，先移除
        this.hideAmrDetails();
        
        // 创建详情框
        this.amrDetails = new PIXI.Container();
        this.amrDetails.position.set(x, y - 80);
        
        // 背景
        const bg = new PIXI.Graphics();
        bg.lineStyle(1, 0x3e4756, 1);
        bg.beginFill(0x1a1f25, 0.9);
        bg.drawRect(-60, -40, 120, 80);
        bg.endFill();
        
        // 内容
        const title = new PIXI.Text(data.id, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: 0xe0e0e0,
            fontWeight: 'bold'
        });
        title.position.set(-title.width / 2, -35);
        
        const stateText = new PIXI.Text(`状态: ${data.state}`, {
            fontFamily: 'Arial',
            fontSize: 9,
            fill: 0xe0e0e0
        });
        stateText.position.set(-55, -15);
        
        const speedText = new PIXI.Text(`速度: ${data.speed} m/s`, {
            fontFamily: 'Arial',
            fontSize: 9,
            fill: 0xe0e0e0
        });
        speedText.position.set(-55, 0);
        
        const batteryText = new PIXI.Text(`电量: ${Math.floor(Math.random() * 30) + 70}%`, {
            fontFamily: 'Arial',
            fontSize: 9,
            fill: 0xe0e0e0
        });
        batteryText.position.set(-55, 15);
        
        this.amrDetails.addChild(bg);
        this.amrDetails.addChild(title);
        this.amrDetails.addChild(stateText);
        this.amrDetails.addChild(speedText);
        this.amrDetails.addChild(batteryText);
        
        this.amrContainer.addChild(this.amrDetails);
    }
    
    // 隐藏AMR详情
    hideAmrDetails() {
        if (this.amrDetails) {
            this.amrContainer.removeChild(this.amrDetails);
            this.amrDetails = null;
        }
    }
    
    // 初始化路径
    drawPaths() {
        console.log("初始化路径容器...");
        
        // 初始化AGV路径容器
        this.agvPaths = {
            'AGV-001': null,
            'AGV-002': null
        };
        
        // 初始化本地路径数据
        this.localPathData = {
            'AGV-001': { targetIndex: 0, lastUpdate: 0, currentPath: [] },
            'AGV-002': { targetIndex: 0, lastUpdate: 0, currentPath: [] }
        };
        
        // 确保路径容器的可见性
        if (this.pathContainer) {
            this.pathContainer.visible = true;
            this.pathContainer.alpha = 1;
            console.log("路径容器已初始化，可见性设置为true");
        } else {
            console.warn("路径容器不存在，可能未正确初始化");
        }
    }
    
    // 绘制单条路径
    drawPath(points, color, alpha) {
        const path = new PIXI.Graphics();
        path.lineStyle(3, color, alpha);
        
        // 移动到第一个点
        path.moveTo(points[0].x, points[0].y);
        
        // 绘制到其他点的曲线
        for (let i = 1; i < points.length; i++) {
            path.lineTo(points[i].x, points[i].y);
        }
        
        this.pathContainer.addChild(path);
    }
    
    // 绘制AGV的活动路径
    drawActivePath(agvId, points) {
        console.log(`绘制AGV ${agvId} 路径，点数: ${points.length}`);
        
        // 清除当前AGV的旧路径
        if (this.agvPaths[agvId] && this.agvPaths[agvId].container) {
            console.log(`清除AGV ${agvId} 旧路径`);
            this.pathContainer.removeChild(this.agvPaths[agvId].container);
        }
        
        // 如果点数小于2，无法绘制路径
        if (!points || points.length < 2) {
            console.warn(`AGV ${agvId} 路径点数不足，无法绘制路径`);
            this.agvPaths[agvId] = null;
            return;
        }
        
        try {
            // 创建新的容器
            const container = new PIXI.Container();
            
            // 获取对应AGV的颜色
            let pathColor;
            // 查找对应的AGV对象
            const amrObj = this.amrList.find(amr => amr.data.id === agvId);
            
            if (amrObj && amrObj.data.color) {
                // 使用AGV的颜色
                pathColor = amrObj.data.color;
                console.log(`AGV ${agvId} 使用车辆颜色: ${pathColor.toString(16)}`);
            } else {
                // 备用方案：根据AGV ID使用不同的默认颜色
                if (agvId === 'AGV-001') {
                    pathColor = 0x00FF00; // 绿色
                } else if (agvId === 'AGV-002') {
                    pathColor = 0x2196f3; // 蓝色
                } else {
                    pathColor = 0xFFA500; // 橙色，用于其他AGV
                }
                console.log(`AGV ${agvId} 使用默认颜色: ${pathColor.toString(16)}`);
            }
            
            // 创建路径图形
            const path = new PIXI.Graphics();
            path.lineStyle(4, pathColor, 1); // 增加线条宽度使其更明显
            
            // 绘制路径的起点
            path.moveTo(points[0].x, points[0].y);
            console.log(`路径起点: (${points[0].x}, ${points[0].y})`);
            
            // 绘制路径点
            for (let i = 1; i < points.length; i++) {
                path.lineTo(points[i].x, points[i].y);
                console.log(`路径点${i}: (${points[i].x}, ${points[i].y})`);
            }
            
            // 确保路径有终点标记
            const endPoint = points[points.length - 1];
            path.beginFill(pathColor, 0.8);
            path.drawCircle(endPoint.x, endPoint.y, 6); // 终点标记
            path.endFill();
            
            container.addChild(path);
            
            // 创建用于动画的遮罩
            const mask = new PIXI.Graphics();
            container.addChild(mask);
            
            // 创建一个精灵用作流动效果
            const texture = PIXI.Texture.WHITE;
            const sprite = new PIXI.Sprite(texture);
            sprite.tint = pathColor; // 使用相同的颜色
            sprite.blendMode = PIXI.BLEND_MODES.ADD;
            sprite.alpha = 0.8;
            sprite.mask = mask;
            container.addChild(sprite);
            
            // 设置精灵覆盖整个可视区域
            sprite.width = this.app.renderer.width;
            sprite.height = this.app.renderer.height;
            sprite.position.set(-this.app.renderer.width/2, -this.app.renderer.height/2);
            
            // 将容器添加到路径容器
            this.pathContainer.addChild(container);
            
            // 存储路径数据
            this.agvPaths[agvId] = {
                container,
                path,
                mask,
                sprite,
                points,
                progress: 0,
                animationSpeed: 0.005, // 动画速度，调小一些让效果更平滑
                totalLength: this.calculatePathLength(points),
                color: pathColor // 存储颜色信息
            };
            
            // 确保路径容器可见
            this.pathContainer.visible = true;
            this.pathContainer.alpha = 1;
            
            // 将容器置于最上层
            this.app.stage.removeChild(this.pathContainer);
            this.app.stage.addChild(this.pathContainer);
            
            // 添加调试信息
            console.log(`完成绘制AGV ${agvId} 路径，总长度: ${this.agvPaths[agvId].totalLength}`);
        } catch (error) {
            console.error(`绘制AGV ${agvId} 路径时出错:`, error);
        }
    }
    
    // 获取AGV-001的路径点（顺时针运行）
    getPathForAgv001(startPoint, endPoint) {
        // 定义关键路径点 - 顺时针九宫格
        const keyPoints = [
            { x: -200, y: -200 }, // 左上
            { x: 0, y: -200 },    // 上中
            { x: 200, y: -200 },  // 右上
            { x: 200, y: 0 },     // 右中
            { x: 200, y: 200 },   // 右下
            { x: 0, y: 200 },     // 下中
            { x: -200, y: 200 },  // 左下
            { x: -200, y: 0 }     // 左中
        ];
        
        return this.calculateAgvPath(startPoint, endPoint, keyPoints);
    }
    
    // 获取AGV-002的路径点（逆时针运行）
    getPathForAgv002(startPoint, endPoint) {
        // 定义关键路径点 - 逆时针九宫格
        const keyPoints = [
            { x: -200, y: -200 }, // 左上
            { x: -200, y: 0 },    // 左中
            { x: -200, y: 200 },  // 左下
            { x: 0, y: 200 },     // 下中
            { x: 200, y: 200 },   // 右下
            { x: 200, y: 0 },     // 右中
            { x: 200, y: -200 },  // 右上
            { x: 0, y: -200 }     // 上中
        ];
        
        return this.calculateAgvPath(startPoint, endPoint, keyPoints);
    }
    
    // 计算从起点到终点的路径
    calculateAgvPath(startPoint, endPoint, keyPoints) {
        // 找到最近的关键点作为起点参考
        let startIndex = this.findNearestPointIndex(startPoint, keyPoints);
        let endIndex = this.findNearestPointIndex(endPoint, keyPoints);
        
        // 构建路径
        const path = [];
        
        // 从起点到第一个关键点
        path.push(startPoint);
        
        // 如果起点和终点都接近同一个关键点，直接返回起点到终点的直线
        if (startIndex === endIndex && 
            this.getDistance(startPoint, keyPoints[startIndex]) < 50 &&
            this.getDistance(endPoint, keyPoints[endIndex]) < 50) {
            path.push(endPoint);
            return path;
        }
        
        // 添加起点到第一个关键点之后的路径点
        let currentIndex = startIndex;
        
        // 沿着关键点路径前进，直到接近终点
        let maxPathPoints = keyPoints.length + 1; // 防止无限循环
        while (currentIndex !== endIndex && maxPathPoints > 0) {
            // 添加当前关键点
            path.push(keyPoints[currentIndex]);
            
            // 移动到下一个关键点
            currentIndex = (currentIndex + 1) % keyPoints.length;
            maxPathPoints--;
        }
        
        // 添加终点附近的关键点
        path.push(keyPoints[endIndex]);
        
        // 添加终点
        path.push(endPoint);
        
        return path;
    }
    
    // 查找最近的关键点索引
    findNearestPointIndex(point, keyPoints) {
        let minDistance = Number.MAX_VALUE;
        let nearestIndex = 0;
        
        for (let i = 0; i < keyPoints.length; i++) {
            const distance = this.getDistance(point, keyPoints[i]);
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = i;
            }
        }
        
        return nearestIndex;
    }
    
    // 计算两点之间的距离
    getDistance(point1, point2) {
        return Math.sqrt(
            Math.pow(point1.x - point2.x, 2) + 
            Math.pow(point1.y - point2.y, 2)
        );
    }
    
    // 计算路径总长度
    calculatePathLength(points) {
        let length = 0;
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i-1].x;
            const dy = points[i].y - points[i-1].y;
            length += Math.sqrt(dx * dx + dy * dy);
        }
        return length;
    }
    
    // 更新路径动画
    updatePathAnimations() {
        // 调试信息
        if (Object.keys(this.agvPaths).length > 0) {
            let activePaths = 0;
            Object.keys(this.agvPaths).forEach(agvId => {
                if (this.agvPaths[agvId]) activePaths++;
            });
            if (activePaths > 0) {
                console.log(`更新${activePaths}条活动路径的动画`);
            }
        }
        
        Object.keys(this.agvPaths).forEach(agvId => {
            const pathData = this.agvPaths[agvId];
            if (!pathData) return;
            
            // 更新进度
            pathData.progress += pathData.animationSpeed;
            if (pathData.progress > 1) {
                pathData.progress = 0;
            }
            
            // 更新遮罩以创建流动效果
            pathData.mask.clear();
            pathData.mask.lineStyle(4, 0xffffff, 1);
            
            // 使用更连续的动画
            const startPoint = pathData.points[0];
            const endPoint = pathData.points[1];
            
            // 计算流动的长度
            const pathLength = Math.sqrt(
                Math.pow(endPoint.x - startPoint.x, 2) + 
                Math.pow(endPoint.y - startPoint.y, 2)
            );
            
            // 流动效果长度 (线条的30%)
            const flowLength = pathLength * 0.3;
            
            // 起点位置
            const startProgress = pathData.progress;
            
            // 终点位置 (确保不超过1)
            let endProgress = startProgress + (flowLength / pathLength);
            if (endProgress > 1) {
                endProgress = 1;
            }
            
            // 计算动画起点
            const startX = startPoint.x + (endPoint.x - startPoint.x) * startProgress;
            const startY = startPoint.y + (endPoint.y - startPoint.y) * startProgress;
            
            // 计算动画终点
            const endX = startPoint.x + (endPoint.x - startPoint.x) * endProgress;
            const endY = startPoint.y + (endPoint.y - startPoint.y) * endProgress;
            
            // 绘制动画部分
            pathData.mask.moveTo(startX, startY);
            pathData.mask.lineTo(endX, endY);
        });
    }
    
    // 动画循环
    async animate() {
        try {
            // 检查数据源是否存在
            if (!this.dataManager) {
                console.error("数据源未就绪，无法继续");
                // 停止动画循环
                return;
            }
            
            // 更新AMR位置和路径
            await this.updateAMRs();
            
            // 更新货位状态
            await this.updateLocations();
            
            // 更新跟随视图
            this.updateCameraFollow();
            
            // 更新路径动画效果
            this.updatePathAnimations();
            
            // 安排下一帧
            requestAnimationFrame(() => this.animate());
        } catch (error) {
            console.error("动画循环出错:", error);
            // 出错后不再继续动画
            this.showError(`系统运行错误: ${error.message}`);
        }
    }
    
    // 显示错误信息
    showError(message) {
        if (!this.errorShown) {
            this.errorShown = true;
            
            // 创建错误提示元素
            const errorContainer = document.createElement('div');
            errorContainer.style.position = 'absolute';
            errorContainer.style.top = '10px';
            errorContainer.style.left = '50%';
            errorContainer.style.transform = 'translateX(-50%)';
            errorContainer.style.padding = '10px 20px';
            errorContainer.style.background = 'rgba(244, 67, 54, 0.9)';
            errorContainer.style.color = 'white';
            errorContainer.style.borderRadius = '4px';
            errorContainer.style.zIndex = '1000';
            errorContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
            errorContainer.textContent = message;
            
            // 添加到容器
            this.container.appendChild(errorContainer);
            
            // 5秒后自动隐藏
            setTimeout(() => {
                this.container.removeChild(errorContainer);
                this.errorShown = false;
                
                // 尝试重新启动动画
                requestAnimationFrame(() => this.animate());
            }, 5000);
        }
    }
    
    // 更新货位状态
    async updateLocations() {
        try {
            // 检查数据管理器是否存在
            if (!this.dataManager) {
                console.warn("updateLocations: 数据源未就绪");
                return;
            }
            
            // 获取所有货位
            let locations = [];
            if (typeof this.dataManager.getAllLocations === 'function') {
                // 处理异步和同步两种情况
                if (this.dataManager.getAllLocations.constructor.name === 'AsyncFunction') {
                    locations = await this.dataManager.getAllLocations();
                } else {
                    locations = this.dataManager.getAllLocations();
                }
            }
            
            // 如果没有获取到货位数据，则退出
            if (!locations || locations.length === 0) {
                return;
            }
            
            // 遍历所有货位，更新状态
            for (const location of locations) {
                try {
                    const stationId = location.id;
                    const station = this.stations[stationId];
                    
                    if (station) {
                        // 获取区域信息
                        const area = location.area || '';
                        
                        // 更新状态文本
                        const statusText = station.children[2];
                        statusText.text = this.getStatusText(location.status);
                        statusText.position.set(-statusText.width / 2, 20);
                        
                        // 更新容量信息
                        const capacityText = station.children[3];
                        capacityText.text = `${location.currentCapacity}/${location.maxCapacity}`;
                        capacityText.position.set(-capacityText.width / 2, -30);
                        
                        // 更新中文名称
                        const displayName = this.getLocationDisplayName(location.id, area);
                        const nameText = station.children[4]; // 第5个子元素是名称文本
                        if (nameText) {
                            nameText.text = displayName;
                            nameText.position.set(-nameText.width / 2, -60);
                        }
                        
                        // 更新图标颜色
                        const icon = station.children[0];
                        
                        // 根据状态设置颜色
                        let fillColor;
                        switch (location.status) {
                            case 'empty':
                                fillColor = 0x1a1f25; // 深蓝灰色
                                break;
                            case 'occupied':
                                // 根据容量百分比设置颜色深浅
                                const fillRatio = location.currentCapacity / location.maxCapacity;
                                const r = Math.floor(45 + fillRatio * 210); // 从深蓝到浅蓝
                                const g = Math.floor(80 + fillRatio * 175);
                                const b = Math.floor(130 + fillRatio * 125);
                                fillColor = (r << 16) | (g << 8) | b;
                                break;
                            case 'maintenance':
                                fillColor = 0xf44336; // 红色
                                break;
                            default:
                                fillColor = 0x1a1f25;
                        }
                        
                        // 重绘图标
                        icon.clear();
                        icon.lineStyle(2, 0x2196f3, 1);
                        icon.beginFill(fillColor, 0.8);
                        icon.drawRect(-40, -40, 80, 80);
                        icon.endFill();
                        
                        // 更新存储的数据
                        station.locationData = {
                            id: location.id,
                            name: location.name,
                            status: location.status,
                            capacity: location.currentCapacity,
                            maxCapacity: location.maxCapacity,
                            area: location.area
                        };
                    }
                } catch (err) {
                    console.error(`更新货位 ${location.id} 时出错:`, err);
                }
            }
        } catch (error) {
            console.error("更新货位时发生错误:", error);
        }
    }

    // 添加视角跟随更新方法
    updateCameraFollow() {
        if (this.followingAmr) {
            // 查找对应的AMR对象
            const amrObj = this.amrList.find(amr => amr.data.id === this.followingAmr);
            
            if (amrObj) {
                const targetX = this.app.screen.width / 2 - amrObj.position.x * this.mapScale;
                const targetY = this.app.screen.height / 2 - amrObj.position.y * this.mapScale;
    
                // 平滑移动视角
                [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
                    const dx = targetX - container.position.x;
                    const dy = targetY - container.position.y;
                    
                    container.position.x += dx * 0.1;
                    container.position.y += dy * 0.1;
                });
            }
        }
    }

    // 修改updateMapTransform方法
    updateMapTransform() {
        const containers = [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer];
        containers.forEach(container => {
            container.scale.set(this.mapScale);
            container.position.set(
                this.app.screen.width / 2 + this.lastDragX,
                this.app.screen.height / 2 + this.lastDragY
            );
        });
    }

    // 修改resetView方法
    resetView() {
        this.mapScale = 1.0;
        this.lastDragX = 0;
        this.lastDragY = 0;
        this.updateMapTransform();
    }

    // 添加控制按钮
    addControlButtons() {
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'map-controls';
        controlsContainer.style.cssText = `
            position: absolute;
            right: 20px;
            top: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 1000;
        `;

        const zoomInBtn = this.createControlButton('+', '放大');
        const zoomOutBtn = this.createControlButton('-', '缩小');
        const resetBtn = this.createControlButton('R', '重置视图');

        zoomInBtn.addEventListener('click', () => this.zoomIn());
        zoomOutBtn.addEventListener('click', () => this.zoomOut());
        resetBtn.addEventListener('click', () => this.resetView());

        controlsContainer.appendChild(zoomInBtn);
        controlsContainer.appendChild(zoomOutBtn);
        controlsContainer.appendChild(resetBtn);

        this.container.appendChild(controlsContainer);
    }

    // 创建控制按钮
    createControlButton(text, title) {
        const button = document.createElement('button');
        button.textContent = text;
        button.title = title;
        button.style.cssText = `
            width: 30px;
            height: 30px;
            border: none;
            border-radius: 4px;
            background: rgba(255, 255, 255, 0.1);
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: background-color 0.3s;
        `;

        button.addEventListener('mouseover', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        });

        button.addEventListener('mouseout', () => {
            button.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });

        return button;
    }

    // 缩放相关方法
    zoomIn() {
        const newScale = Math.min(this.mapScale * 1.1, this.maxScale);
        this.setZoom(newScale);
    }

    zoomOut() {
        const newScale = Math.max(this.mapScale * 0.9, this.minScale);
        this.setZoom(newScale);
    }

    setZoom(scale) {
        const newScale = Math.min(Math.max(scale, this.minScale), this.maxScale);
        if (newScale !== this.mapScale) {
            this.mapScale = newScale;
            this.updateMapTransform();
        }
    }

    // 修改鼠标滚轮缩放事件处理
    addEventListeners() {
        // 窗口大小改变时调整视图
        window.addEventListener('resize', () => {
            this.resizeHandler();
        });

        // 添加鼠标滚轮缩放事件
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            // 获取鼠标在容器中的相对位置
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // 计算鼠标相对于地图中心的偏移
            const centerX = this.app.screen.width / 2;
            const centerY = this.app.screen.height / 2;

            // 计算新的缩放比例
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(Math.max(this.mapScale * zoomFactor, this.minScale), this.maxScale);
            
            if (newScale !== this.mapScale) {
                // 保存旧的缩放比例
                const oldScale = this.mapScale;
                this.mapScale = newScale;

                // 更新所有容器的位置和缩放
                [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
                    container.scale.set(this.mapScale);
                    
                    // 调整位置以保持鼠标指向的点不变
                    const scaleRatio = newScale / oldScale;
                    const dx = (mouseX - centerX) * (1 - scaleRatio);
                    const dy = (mouseY - centerY) * (1 - scaleRatio);
                    
                    container.position.x = centerX + (container.position.x - centerX) * scaleRatio + dx;
                    container.position.y = centerY + (container.position.y - centerY) * scaleRatio + dy;
                });
            }
        });

        // 添加鼠标拖动事件
        this.container.addEventListener('mousedown', (e) => {
            // 只响应左键点击
            if (e.button !== 0) return;
            
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.lastDragX = this.mapContainer.position.x;
            this.lastDragY = this.mapContainer.position.y;
            
            // 改变鼠标样式
            this.container.style.cursor = 'grabbing';
        });

        // 鼠标移动事件
        this.container.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            // 如果正在跟随AMR，则取消跟随
            if (this.followingAmr) {
                this.followingAmr = null;
            }
            
            // 计算移动距离
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            // 更新所有容器的位置
            [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
                container.position.x = this.lastDragX + dx;
                container.position.y = this.lastDragY + dy;
            });
        });

        // 鼠标松开事件
        const endDrag = () => {
            if (!this.isDragging) return;
            
            this.isDragging = false;
            this.container.style.cursor = 'grab';
        };

        this.container.addEventListener('mouseup', endDrag);
        this.container.addEventListener('mouseleave', endDrag);

        // 设置默认鼠标样式
        this.container.style.cursor = 'grab';
    }
    
    // 处理窗口大小变化
    resizeHandler() {
        // 获取父容器的实际尺寸
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // 更新渲染器尺寸
        this.app.renderer.resize(width, height);
        
        // 计算适合的缩放比例
        const scaleX = width / this.mapSize;
        const scaleY = height / this.mapSize;
        const scale = Math.min(scaleX, scaleY) * 0.8; // 留出一些边距
        
        // 设置缩放
        this.mapScale = Math.min(Math.max(scale, this.minScale), this.maxScale);
        
        // 更新所有容器的位置和缩放
        [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
            container.scale.set(this.mapScale);
            container.position.set(
                width / 2,
                height / 2
            );
        });
        
        // 重置拖动位置
        this.lastDragX = 0;
        this.lastDragY = 0;
    }

    // 更新AMR位置和状态
    async updateAMRs() {
        try {
            // 记录最后更新时间
            this.lastUpdateTime = Date.now();
            
            // 检查数据管理器是否存在
            if (!this.dataManager) {
                console.warn("updateAMRs: 数据源未就绪");
                return;
            }
            
            // 获取所有车辆数据
            let vehicles = [];
            if (typeof this.dataManager.getAllVehicles === 'function') {
                // 处理异步和同步两种情况
                if (this.dataManager.getAllVehicles.constructor.name === 'AsyncFunction') {
                    vehicles = await this.dataManager.getAllVehicles();
                } else {
                    vehicles = this.dataManager.getAllVehicles();
                }
            }
            
            // 如果没有获取到车辆数据，则退出
            if (!vehicles || vehicles.length === 0) {
                return;
            }
            
            // 遍历AMR列表进行更新
            for (const amr of this.amrList) {
                try {
                    // 获取对应的车辆数据
                    let vehicle = null;
                    if (typeof this.dataManager.getVehicleById === 'function') {
                        // 处理异步和同步两种情况
                        if (this.dataManager.getVehicleById.constructor.name === 'AsyncFunction') {
                            vehicle = await this.dataManager.getVehicleById(amr.data.id);
                        } else {
                            vehicle = this.dataManager.getVehicleById(amr.data.id);
                        }
                    } else {
                        // 从车辆列表中查找
                        vehicle = vehicles.find(v => v.id === amr.data.id);
                    }
                    
                    if (vehicle) {
                        // 确保车辆数据中包含颜色
                        if (!vehicle.color && amr.data.color) {
                            vehicle.color = amr.data.color;
                        }
                        
                        // 平滑更新位置
                        const currentX = amr.position.x;
                        const currentY = amr.position.y;
                        const targetX = vehicle.position.x;
                        const targetY = vehicle.position.y;
                        
                        // 如果位置相差过大，直接更新位置
                        const distanceThreshold = 100;
                        const dx = targetX - currentX;
                        const dy = targetY - currentY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        
                        if (distance > distanceThreshold) {
                            // 直接更新位置
                            amr.position.x = targetX;
                            amr.position.y = targetY;
                        } else {
                            // 平滑过渡到新位置
                            const smoothFactor = 0.1; // 数值越小，过渡越平滑
                            amr.position.x += (targetX - currentX) * smoothFactor;
                            amr.position.y += (targetY - currentY) * smoothFactor;
                        }

                        // 更新状态指示器颜色
                        const statusIndicator = amr.children[2];
                        statusIndicator.clear();
                        statusIndicator.beginFill(this.getStatusColor(vehicle.status));
                        statusIndicator.drawCircle(15, -10, 3);
                        statusIndicator.endFill();

                        // 更新数据
                        amr.data.state = vehicle.status;
                        amr.data.x = amr.position.x;
                        amr.data.y = amr.position.y;
                        
                        // 确保颜色保持一致
                        if (vehicle.color && amr.data.color !== vehicle.color) {
                            amr.data.color = vehicle.color;
                            
                            // 更新AMR外观颜色
                            const body = amr.children[0];
                            body.clear();
                            body.lineStyle(2, amr.data.color, 1);
                            body.beginFill(0x1a1f25, 0.8);
                            body.drawRect(-20, -15, 40, 30);
                            body.endFill();
                            
                            // 更新文字颜色
                            const text = amr.children[1];
                            text.style.fill = amr.data.color;
                        }
                        
                        // 更新AGV路径显示
                        this.updateAgvPathDisplay(vehicle);
                    }
                } catch (err) {
                    console.error(`更新AMR ${amr.data.id} 时出错:`, err);
                }
            }
            
            // 更新路径动画
            this.updatePathAnimations();
        } catch (error) {
            console.error("更新AMR时发生错误:", error);
        }
    }

    // 更新AGV路径显示
    updateAgvPathDisplay(vehicle) {
        // 添加调试日志，查看vehicle对象是否包含path属性
        console.log(`更新AGV ${vehicle.id} 路径，当前位置: (${vehicle.position.x}, ${vehicle.position.y})`);
        console.log(`AGV ${vehicle.id} path数据:`, vehicle.path);
        
        const agvId = vehicle.id;
        const currentPos = { x: vehicle.position.x, y: vehicle.position.y };
        
        // 防止频繁更新造成闪烁
        if (!this.localPathData) {
            this.localPathData = {
                'AGV-001': { targetIndex: 0, lastUpdate: 0, currentPath: [] },
                'AGV-002': { targetIndex: 0, lastUpdate: 0, currentPath: [] }
            };
        }
        
        // 初始化当前AGV的本地数据
        if (!this.localPathData[agvId]) {
            this.localPathData[agvId] = { targetIndex: 0, lastUpdate: 0, currentPath: [] };
        }
        
        // 控制路径更新频率，避免频繁重绘
        const now = Date.now();
        const updateInterval = 500; // 路径更新间隔（毫秒）
        
        if (!this.localPathData[agvId].lastUpdate) {
            this.localPathData[agvId].lastUpdate = now;
        }
        
        // 检查是否需要更新路径
        const pathUpdateNeeded = now - this.localPathData[agvId].lastUpdate > updateInterval;
        
        // 使用后端提供的路径数据
        if (vehicle.path && Array.isArray(vehicle.path) && vehicle.path.length >= 2) {
            console.log(`AGV ${agvId} 使用后端路径数据，路径点数量: ${vehicle.path.length}`);
            
            // 获取后端提供的路径数据
            const backendPath = vehicle.path;
            
            // 检查路径是否发生变化 - 比较第一个和最后一个点即可
            const pathChanged = 
                !this.localPathData[agvId].currentPath || 
                this.localPathData[agvId].currentPath.length !== backendPath.length ||
                !this.pathsEqual(this.localPathData[agvId].currentPath, backendPath);
                
            // 仅在路径变化或需要定期更新时重绘路径
            if (pathChanged || pathUpdateNeeded) {
                console.log(`AGV ${agvId} 路径变化或需要更新，重绘路径`);
                
                // 更新本地数据
                this.localPathData[agvId].currentPath = [...backendPath];
                this.localPathData[agvId].lastUpdate = now;
                
                // 绘制导航线
                this.drawActivePath(agvId, backendPath);
            }
        } else {
            // 后端未提供路径数据，使用简单直线路径
            console.log(`AGV ${agvId} 后端未提供路径数据，尝试使用简单直线路径`);
            
            // 查找Vehicle对象中的targetLocation或targetPosition
            let targetPos = null;
            
            if (vehicle.targetLocation) {
                targetPos = vehicle.targetLocation;
                console.log(`AGV ${agvId} 使用targetLocation: (${targetPos.x}, ${targetPos.y})`);
            } else if (vehicle.targetPosition) {
                targetPos = vehicle.targetPosition;
                console.log(`AGV ${agvId} 使用targetPosition: (${targetPos.x}, ${targetPos.y})`);
            }
            
            // 如果有目标位置，绘制简单路径
            if (targetPos) {
                const simplePath = [currentPos, targetPos];
                console.log(`AGV ${agvId} 创建简单路径: 从(${currentPos.x}, ${currentPos.y})到(${targetPos.x}, ${targetPos.y})`);
                
                // 检查路径是否发生变化
                const pathChanged = 
                    !this.localPathData[agvId].currentPath || 
                    !this.pathsEqual(this.localPathData[agvId].currentPath, simplePath);
                    
                if (pathChanged || pathUpdateNeeded) {
                    console.log(`AGV ${agvId} 简单路径变化或需要更新，重绘路径`);
                    
                    // 更新本地数据
                    this.localPathData[agvId].currentPath = [...simplePath];
                    this.localPathData[agvId].lastUpdate = now;
                    
                    // 绘制导航线
                    this.drawActivePath(agvId, simplePath);
                }
            } else {
                console.log(`AGV ${agvId} 没有目标位置，清除现有路径`);
                
                // 没有路径和目标位置，清除现有路径
                if (this.agvPaths[agvId]) {
                    this.pathContainer.removeChild(this.agvPaths[agvId].container);
                    this.agvPaths[agvId] = null;
                }
            }
        }
    }
    
    // 比较两个路径是否相等
    pathsEqual(path1, path2) {
        if (!path1 || !path2 || path1.length !== path2.length) {
            return false;
        }
        
        // 只比较第一个和最后一个点，减少计算
        const firstPointsEqual = 
            Math.abs(path1[0].x - path2[0].x) < 1 && 
            Math.abs(path1[0].y - path2[0].y) < 1;
            
        const lastPointsEqual = 
            Math.abs(path1[path1.length-1].x - path2[path2.length-1].x) < 1 && 
            Math.abs(path1[path1.length-1].y - path2[path2.length-1].y) < 1;
            
        return firstPointsEqual && lastPointsEqual;
    }
} 