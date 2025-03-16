const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

// 启用CORS和JSON解析
app.use(cors());
app.use(express.json());

// 存储实时数据
let scadaData = null;

// 货位坐标缓存
const locationCoordinates = [];

// AGV路径规划
const agv1Path = [0, 1, 2, 5, 8, 7, 6, 3, 0]; // 顺时针
const agv2Path = [8, 7, 6, 3, 0, 1, 2, 5, 8]; // 逆时针

// AGV当前路径索引
let agv1PathIndex = 0;
let agv2PathIndex = 0;

// AGV移动速度 (单位: 像素/秒)
const AGV_SPEED = 40;

// 初始化数据
async function initializeData() {
    try {
        const dataPath = path.join(__dirname, '../config/data_source.json');
        const rawData = await fs.readFile(dataPath, 'utf8');
        scadaData = JSON.parse(rawData);
        
        // 缓存所有货位的坐标
        scadaData.dataSource.storage.locations.forEach(location => {
            locationCoordinates.push({
                id: location.id,
                x: location.coordinates.x,
                y: location.coordinates.y
            });
        });
        
        console.log('数据源初始化成功');
    } catch (error) {
        console.error('数据源初始化失败:', error);
        process.exit(1);
    }
}

// 获取所有数据
app.get('/api/scada/data', (req, res) => {
    res.json(scadaData);
});

// 获取AGV1路径信息
app.get('/api/scada/agv1Path', (req, res) => {
    res.json({ path: agv1Path });
});

// 获取AGV2路径信息
app.get('/api/scada/agv2Path', (req, res) => {
    res.json({ path: agv2Path });
});

// 获取AGV1当前路径索引
app.get('/api/scada/agv1PathIndex', (req, res) => {
    res.json({ pathIndex: agv1PathIndex });
});

// 获取AGV2当前路径索引
app.get('/api/scada/agv2PathIndex', (req, res) => {
    res.json({ pathIndex: agv2PathIndex });
});

// 获取所有货位
app.get('/api/scada/locations', (req, res) => {
    res.json(scadaData.dataSource.storage.locations);
});

// 获取所有车辆
app.get('/api/scada/vehicles', (req, res) => {
    res.json(scadaData.dataSource.vehicles);
});

// 获取特定货位
app.get('/api/scada/locations/:id', (req, res) => {
    const location = scadaData.dataSource.storage.locations.find(
        loc => loc.id === req.params.id
    );
    if (location) {
        res.json(location);
    } else {
        res.status(404).json({ error: '货位不存在' });
    }
});

// 获取特定车辆
app.get('/api/scada/vehicles/:id', (req, res) => {
    const vehicle = scadaData.dataSource.vehicles.find(
        v => v.id === req.params.id
    );
    if (vehicle) {
        res.json(vehicle);
    } else {
        res.status(404).json({ error: '车辆不存在' });
    }
});

// 更新车辆状态
app.put('/api/scada/vehicles/:id', (req, res) => {
    const { status, position } = req.body;
    const vehicle = scadaData.dataSource.vehicles.find(
        v => v.id === req.params.id
    );
    
    if (vehicle) {
        if (status) vehicle.status = status;
        if (position) vehicle.position = position;
        res.json(vehicle);
    } else {
        res.status(404).json({ error: '车辆不存在' });
    }
});

// 计算两点之间的距离
function distance(x1, y1, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// 计算两点之间的角度
function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

// 模拟AGV按路径移动
function moveAgv(agv, targetX, targetY, onArrival) {
    // 当前位置
    const currentX = agv.position.x;
    const currentY = agv.position.y;
    
    // 计算距离和角度
    const dist = distance(currentX, currentY, targetX, targetY);
    const ang = angle(currentX, currentY, targetX, targetY);
    
    // 如果已经非常接近目标点，直接到达
    if (dist < 5) {
        agv.position.x = targetX;
        agv.position.y = targetY;
        onArrival();
        return;
    }
    
    // 计算移动步长 (按每次更新移动的距离)
    // 使用较小的移动步长使运动更平滑
    const moveStep = AGV_SPEED / 10;
    
    // 计算新位置
    agv.position.x += Math.cos(ang) * moveStep;
    agv.position.y += Math.sin(ang) * moveStep;
}

// 模拟数据更新
function simulateDataUpdates() {
    // 每100毫秒更新一次 (更平滑的移动效果)
    setInterval(() => {
        if (scadaData && scadaData.dataSource.vehicles && locationCoordinates.length > 0) {
            // 获取两辆AGV
            const agv1 = scadaData.dataSource.vehicles.find(v => v.id === 'AGV-001');
            const agv2 = scadaData.dataSource.vehicles.find(v => v.id === 'AGV-002');
            
            if (agv1 && agv2) {
                // 移动AGV-001
                const agv1Target = locationCoordinates[agv1Path[agv1PathIndex]];
                
                // 构建 AGV-001 完整路径
                const agv1FullPath = [];
                // 起点是当前位置
                agv1FullPath.push({ x: agv1.position.x, y: agv1.position.y });
                
                // 添加当前目标点和后续路径点
                let nextPoints = [];
                for (let i = 0; i < 3; i++) {
                    const pathIndex = (agv1PathIndex + i) % agv1Path.length;
                    nextPoints.push(locationCoordinates[agv1Path[pathIndex]]);
                }
                
                // 计算从当前位置到目标路径的中间点
                const intermediatePoints = calculateIntermediatePoints(
                    agv1.position, 
                    agv1Target,
                    2 // 生成2个中间点
                );
                
                // 添加中间点和目标点
                agv1FullPath.push(...intermediatePoints);
                agv1FullPath.push(agv1Target);
                
                // 添加后续路径点
                for (let i = 1; i < nextPoints.length; i++) {
                    agv1FullPath.push(nextPoints[i]);
                }
                
                // 将完整路径添加到 AGV 对象
                agv1.path = agv1FullPath;
                
                moveAgv(agv1, agv1Target.x, agv1Target.y, () => {
                    // 到达目标位置后更新路径索引
                    agv1PathIndex = (agv1PathIndex + 1) % agv1Path.length;
                    
                    // 随机更新货位状态
                    if (Math.random() < 0.3) {
                        const location = scadaData.dataSource.storage.locations.find(
                            loc => loc.id === `L${agv1Path[agv1PathIndex] + 1}`
                        );
                        if (location) {
                            // 模拟装载/卸载操作
                            if (location.status === 'empty') {
                                location.status = 'occupied';
                                location.currentCapacity = Math.floor(Math.random() * location.maxCapacity);
                            } else {
                                location.status = 'empty';
                                location.currentCapacity = 0;
                            }
                        }
                    }
                });
                
                // 移动AGV-002
                const agv2Target = locationCoordinates[agv2Path[agv2PathIndex]];
                
                // 构建 AGV-002 完整路径
                const agv2FullPath = [];
                // 起点是当前位置
                agv2FullPath.push({ x: agv2.position.x, y: agv2.position.y });
                
                // 添加当前目标点和后续路径点
                let agv2NextPoints = [];
                for (let i = 0; i < 3; i++) {
                    const pathIndex = (agv2PathIndex + i) % agv2Path.length;
                    agv2NextPoints.push(locationCoordinates[agv2Path[pathIndex]]);
                }
                
                // 计算从当前位置到目标路径的中间点
                const agv2IntermediatePoints = calculateIntermediatePoints(
                    agv2.position, 
                    agv2Target,
                    2 // 生成2个中间点
                );
                
                // 添加中间点和目标点
                agv2FullPath.push(...agv2IntermediatePoints);
                agv2FullPath.push(agv2Target);
                
                // 添加后续路径点
                for (let i = 1; i < agv2NextPoints.length; i++) {
                    agv2FullPath.push(agv2NextPoints[i]);
                }
                
                // 将完整路径添加到 AGV 对象
                agv2.path = agv2FullPath;
                
                moveAgv(agv2, agv2Target.x, agv2Target.y, () => {
                    // 到达目标位置后更新路径索引
                    agv2PathIndex = (agv2PathIndex + 1) % agv2Path.length;
                    
                    // 随机更新货位状态
                    if (Math.random() < 0.3) {
                        const location = scadaData.dataSource.storage.locations.find(
                            loc => loc.id === `L${agv2Path[agv2PathIndex] + 1}`
                        );
                        if (location) {
                            // 模拟装载/卸载操作
                            if (location.status === 'empty') {
                                location.status = 'occupied';
                                location.currentCapacity = Math.floor(Math.random() * location.maxCapacity);
                            } else {
                                location.status = 'empty';
                                location.currentCapacity = 0;
                            }
                        }
                    }
                });
                
                // 随机更新AGV状态 (很小概率)
                if (Math.random() < 0.01) {
                    const states = ['idle', 'running', 'error'];
                    agv1.status = states[Math.floor(Math.random() * states.length)];
                }
                
                if (Math.random() < 0.01) {
                    const states = ['idle', 'running', 'error'];
                    agv2.status = states[Math.floor(Math.random() * states.length)];
                }
            }
        }
    }, 100);
}

// 计算两点之间的中间点
function calculateIntermediatePoints(start, end, numPoints) {
    const points = [];
    
    // 随机生成中间点，但确保路径更平滑
    for (let i = 1; i <= numPoints; i++) {
        const ratio = i / (numPoints + 1);
        
        // 使用线性插值计算中间点的基本位置
        const baseX = start.x + (end.x - start.x) * ratio;
        const baseY = start.y + (end.y - start.y) * ratio;
        
        // 添加一些小的随机变化，让路径看起来更自然
        // 但变化不能太大，以保持平滑
        const variationRange = 15; // 变化范围（像素）
        const variationX = (Math.random() - 0.5) * variationRange;
        const variationY = (Math.random() - 0.5) * variationRange;
        
        points.push({
            x: baseX + variationX,
            y: baseY + variationY
        });
    }
    
    return points;
}

// 启动服务器
async function startServer() {
    await initializeData();
    simulateDataUpdates();
    
    app.listen(port, () => {
        console.log(`SCADA API 服务器运行在 http://localhost:${port}`);
    });
}

startServer(); 