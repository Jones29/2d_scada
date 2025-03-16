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
        
        // 初始化PixiJS应用
        this.initPixiApp();
        
        // 添加地图元素
        this.drawFactoryMap();
        
        // 添加控制按钮
        this.addControlButtons();
        
        // 添加AMR和站点
        this.setupStations();
        this.setupAMRs();
        
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
        
        // 添加到舞台
        this.app.stage.addChild(this.mapContainer);
        this.app.stage.addChild(this.pathContainer);
        this.app.stage.addChild(this.stationContainer);
        this.app.stage.addChild(this.amrContainer);
        
        // 居中所有容器
        this.centerContainers();
        
        // 初始化时自动调整大小以适应容器
        this.resizeHandler();
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
        // 绘制工厂背景
        const factory = new PIXI.Graphics();
        factory.lineStyle(2, 0x3e4756, 1);
        factory.beginFill(0x1a1f25, 0.5);
        // 使用固定的地图尺寸，而不是容器尺寸
        const mapSize = 800; // 固定地图尺寸
        factory.drawRect(-mapSize / 2, -mapSize / 2, mapSize, mapSize);
        factory.endFill();
        this.mapContainer.addChild(factory);
        
        // 绘制工厂内部区域
        this.drawArea(-300, -250, 180, 120, 0x2b323c, 'AMR-ROOM');
        this.drawArea(150, -220, 280, 140, 0x2b323c, 'FACTORY-A');
        this.drawArea(-100, 80, 350, 180, 0x2b323c, 'FACTORY-B');
        this.drawArea(-350, 50, 150, 180, 0x2b323c, 'STORAGE');
        
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
    
    // 绘制区域
    drawArea(x, y, width, height, color, name) {
        const area = new PIXI.Graphics();
        area.lineStyle(2, 0x3e4756, 1);
        area.beginFill(color, 0.5);
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
        
        this.mapContainer.addChild(area);
        this.mapContainer.addChild(text);
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
    setupStations() {
        // 定义站点位置
        const stationData = [
            { id: 'S1', x: -250, y: -200, name: 'AMR充电站' },
            { id: 'S2', x: 200, y: -180, name: '物料仓库A' },
            { id: 'S3', x: -280, y: 120, name: '物料仓库B' },
            { id: 'S4', x: 150, y: 150, name: '成品区' },
            { id: 'S5', x: 0, y: 0, name: '中央调度点' }
        ];
        
        stationData.forEach(station => {
            this.createStation(station.id, station.x, station.y, station.name);
        });
    }
    
    // 创建单个站点
    createStation(id, x, y, name) {
        const station = new PIXI.Container();
        station.position.set(x, y);
        
        // 绘制站点图标
        const icon = new PIXI.Graphics();
        icon.lineStyle(2, 0x2196f3, 1);
        icon.beginFill(0x1a1f25, 0.8);
        icon.drawRect(-15, -15, 30, 30);
        icon.endFill();
        
        // 添加站点ID
        const text = new PIXI.Text(id, {
            fontFamily: 'Arial',
            fontSize: 10,
            fill: 0x2196f3,
            align: 'center'
        });
        text.position.set(-text.width / 2, -text.height / 2);
        
        // 悬停文本
        const hoverText = new PIXI.Text(name, {
            fontFamily: 'Arial',
            fontSize: 12,
            fill: 0xe0e0e0,
            align: 'center'
        });
        hoverText.position.set(-hoverText.width / 2, -40);
        hoverText.visible = false;
        
        station.addChild(icon);
        station.addChild(text);
        station.addChild(hoverText);
        
        // 添加交互
        station.interactive = true;
        station.buttonMode = true;
        
        station.on('mouseover', () => {
            hoverText.visible = true;
            icon.tint = 0x64b5f6;
        });
        
        station.on('mouseout', () => {
            hoverText.visible = false;
            icon.tint = 0xffffff;
        });
        
        this.stationContainer.addChild(station);
        this.stations[id] = { container: station, x, y };
    }
    
    // 设置AMR
    setupAMRs() {
        // AMR数据
        const amrData = [
            { id: 'AMR-001', x: -230, y: -180, state: 'charging', speed: 0 },
            { id: 'AMR-002', x: -210, y: -180, state: 'charging', speed: 0 },
            { id: 'AMR-003', x: 180, y: -160, state: 'loading', speed: 0 },
            { id: 'AMR-004', x: -100, y: 100, state: 'moving', speed: 1, path: ['S5', 'S3'] },
            { id: 'AMR-005', x: 50, y: 50, state: 'moving', speed: 1, path: ['S5', 'S4'] },
            { id: 'AMR-006', x: 100, y: 120, state: 'unloading', speed: 0 },
            { id: 'AMR-007', x: 30, y: -30, state: 'idle', speed: 0 }
        ];
        
        amrData.forEach(amr => {
            this.createAMR(amr);
        });
    }
    
    // 创建单个AMR
    createAMR(data) {
        const amr = new PIXI.Container();
        amr.position.set(data.x, data.y);
        
        // 绘制AMR图标
        const icon = new PIXI.Graphics();
        
        // 根据状态设置颜色
        let color;
        switch (data.state) {
            case 'moving': color = 0x2196f3; break;
            case 'charging': color = 0xff9800; break;
            case 'loading': 
            case 'unloading': color = 0xffeb3b; break;
            case 'idle': color = 0x3ddc84; break;
            default: color = 0xe0e0e0;
        }
        
        icon.lineStyle(2, color, 1);
        icon.beginFill(0x1a1f25, 0.8);
        
        // 车身
        icon.drawRect(-10, -7, 20, 14);
        
        // 车轮
        icon.beginFill(color, 1);
        icon.drawCircle(-7, -10, 3);
        icon.drawCircle(7, -10, 3);
        icon.drawCircle(-7, 10, 3);
        icon.drawCircle(7, 10, 3);
        icon.endFill();
        
        // 添加AMR ID
        const text = new PIXI.Text(data.id, {
            fontFamily: 'Arial',
            fontSize: 8,
            fill: 0xe0e0e0,
            align: 'center'
        });
        text.position.set(-text.width / 2, -20);
        
        // 状态指示器
        const statusText = new PIXI.Text(data.state.toUpperCase(), {
            fontFamily: 'Arial',
            fontSize: 7,
            fill: color,
            align: 'center'
        });
        statusText.position.set(-statusText.width / 2, 15);
        
        amr.addChild(icon);
        amr.addChild(text);
        amr.addChild(statusText);
        
        // 添加交互
        amr.interactive = true;
        amr.buttonMode = true;
        
        amr.on('mouseover', () => {
            icon.scale.set(1.2);
            
            // 显示详情弹窗
            this.showAmrDetails(data, amr.x, amr.y);
        });
        
        amr.on('mouseout', () => {
            icon.scale.set(1);
            
            // 隐藏详情弹窗
            this.hideAmrDetails();
        });

        // 添加点击事件处理
        amr.on('click', () => {
            // 如果已经在跟随这个AMR，则取消跟随
            if (this.followingAmr && this.followingAmr.id === data.id) {
                this.followingAmr = null;
                icon.tint = 0xffffff;
            } else {
                // 取消之前跟随的AMR的高亮
                if (this.followingAmr) {
                    this.followingAmr.container.children[0].tint = 0xffffff;
                }
                // 设置新的跟随目标
                this.followingAmr = {
                    id: data.id,
                    container: amr
                };
                // 高亮显示当前跟随的AMR
                icon.tint = 0x00ff00;
            }
        });
        
        this.amrContainer.addChild(amr);
        
        // 存储AMR信息
        this.amrList.push({
            id: data.id,
            container: amr,
            state: data.state,
            speed: data.speed,
            path: data.path || [],
            currentPathIndex: 0,
            targetX: data.x,
            targetY: data.y
        });
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
    
    // 绘制路径
    drawPaths() {
        // 定义路径点
        this.pathPoints = {
            'S1-S5': [
                { x: -250, y: -200 },
                { x: -250, y: -100 },
                { x: -150, y: -50 },
                { x: -75, y: 0 },
                { x: 0, y: 0 }
            ],
            'S2-S5': [
                { x: 200, y: -180 },
                { x: 200, y: -100 },
                { x: 100, y: -50 },
                { x: 50, y: 0 },
                { x: 0, y: 0 }
            ],
            'S3-S5': [
                { x: -280, y: 120 },
                { x: -200, y: 120 },
                { x: -100, y: 80 },
                { x: -50, y: 40 },
                { x: 0, y: 0 }
            ],
            'S4-S5': [
                { x: 150, y: 150 },
                { x: 100, y: 100 },
                { x: 50, y: 50 },
                { x: 0, y: 0 }
            ],
            'S5-S1': [
                { x: 0, y: 0 },
                { x: -75, y: 0 },
                { x: -150, y: -50 },
                { x: -250, y: -100 },
                { x: -250, y: -200 }
            ],
            'S5-S2': [
                { x: 0, y: 0 },
                { x: 50, y: 0 },
                { x: 100, y: -50 },
                { x: 200, y: -100 },
                { x: 200, y: -180 }
            ],
            'S5-S3': [
                { x: 0, y: 0 },
                { x: -50, y: 40 },
                { x: -100, y: 80 },
                { x: -200, y: 120 },
                { x: -280, y: 120 }
            ],
            'S5-S4': [
                { x: 0, y: 0 },
                { x: 50, y: 50 },
                { x: 100, y: 100 },
                { x: 150, y: 150 }
            ]
        };
        
        // 绘制所有路径
        for (const [key, points] of Object.entries(this.pathPoints)) {
            this.drawPath(points, 0x3ddc84, 0.5);
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
    
    // 绘制动态路径
    drawActivePath(points, color) {
        const path = new PIXI.Graphics();
        path.lineStyle(4, color, 1);
        
        // 移动到第一个点
        path.moveTo(points[0].x, points[0].y);
        
        // 绘制到其他点的曲线
        for (let i = 1; i < points.length; i++) {
            path.lineTo(points[i].x, points[i].y);
        }
        
        // 添加动画效果
        const pathMask = new PIXI.Graphics();
        pathMask.lineStyle(4, 0xffffff, 1);
        pathMask.moveTo(points[0].x, points[0].y);
        pathMask.lineTo(points[0].x, points[0].y);
        
        path.mask = pathMask;
        
        this.pathContainer.addChild(path);
        this.pathContainer.addChild(pathMask);
        
        return { path, mask: pathMask, points };
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
                this.followingAmr.container.children[0].tint = 0xffffff;
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
    
    // 动画循环
    animate() {
        // 更新AMR位置
        this.updateAMRs();
        
        // 更新视角跟随
        this.updateCameraFollow();
        
        // 请求下一帧动画
        requestAnimationFrame(() => this.animate());
    }
    
    // 更新AMR位置
    updateAMRs() {
        this.amrList.forEach(amr => {
            if (amr.state === 'moving' && amr.path && amr.path.length > 1) {
                const currentStation = amr.path[amr.currentPathIndex];
                const nextStation = amr.path[amr.currentPathIndex + 1];
                
                if (currentStation && nextStation) {
                    const pathKey = `${currentStation}-${nextStation}`;
                    const pathPoints = this.pathPoints[pathKey];
                    
                    if (pathPoints) {
                        const targetPoint = pathPoints[amr.pathPointIndex || 0];
                        
                        if (targetPoint) {
                            // 计算AMR与目标点之间的距离
                            const dx = targetPoint.x - amr.container.x;
                            const dy = targetPoint.y - amr.container.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            
                            // 如果距离很小，则认为已到达该点
                            if (distance < 2) {
                                // 移动到下一个路径点
                                amr.pathPointIndex = (amr.pathPointIndex || 0) + 1;
                                
                                // 如果已经到达路径的最后一个点
                                if (amr.pathPointIndex >= pathPoints.length) {
                                    // 移动到下一条路径
                                    amr.currentPathIndex++;
                                    amr.pathPointIndex = 0;
                                    
                                    // 如果已经完成所有路径
                                    if (amr.currentPathIndex >= amr.path.length - 1) {
                                        amr.state = 'idle';
                                        return;
                                    }
                                }
                            } else {
                                // 在当前位置和目标点之间移动
                                const moveX = (dx / distance) * amr.speed;
                                const moveY = (dy / distance) * amr.speed;
                                
                                amr.container.x += moveX;
                                amr.container.y += moveY;
                                
                                // 旋转AMR以面向移动方向
                                const angle = Math.atan2(dy, dx);
                                amr.container.rotation = angle + Math.PI / 2;
                            }
                        }
                    }
                }
            }
        });
    }

    // 添加视角跟随更新方法
    updateCameraFollow() {
        if (this.followingAmr) {
            const amr = this.followingAmr.container;
            const targetX = this.app.screen.width / 2 - amr.x * this.mapScale;
            const targetY = this.app.screen.height / 2 - amr.y * this.mapScale;

            // 平滑移动视角
            [this.mapContainer, this.pathContainer, this.stationContainer, this.amrContainer].forEach(container => {
                const dx = targetX - container.position.x;
                const dy = targetY - container.position.y;
                
                container.position.x += dx * 0.1;
                container.position.y += dy * 0.1;
            });
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
}

// 当页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.scadaMap = new ScadaMap('scada-map');
}); 