class ScadaDataManager {
    static #instance = null;
    #config = null;
    #locationMap = new Map();
    #vehicleMap = new Map();
    #apiBaseUrl = 'http://localhost:3000/api/scada';
    #updateInterval = null;
    #lastError = null;

    constructor() {
        if (ScadaDataManager.#instance) {
            return ScadaDataManager.#instance;
        }
        ScadaDataManager.#instance = this;
    }

    static getInstance() {
        if (!ScadaDataManager.#instance) {
            ScadaDataManager.#instance = new ScadaDataManager();
        }
        return ScadaDataManager.#instance;
    }

    async initialize() {
        try {
            // 清空上次错误
            this.#lastError = null;
            
            // 加载初始数据
            const response = await fetch(`${this.#apiBaseUrl}/data`);
            
            // 检查HTTP状态码
            if (!response.ok) {
                throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
            }
            
            // 解析JSON数据
            this.#config = await response.json();
            
            // 验证数据结构
            if (!this.#config || !this.#config.dataSource || 
                !this.#config.dataSource.storage || !this.#config.dataSource.vehicles) {
                throw new Error('后台数据结构无效，缺少必要的字段');
            }
            
            // 初始化数据
            this.#initializeData();
            
            // 启动定期更新
            this.#startUpdates();
            
            console.log('数据源加载成功');
            return true;
        } catch (error) {
            // 提供更详细的错误信息
            let errorMessage = '加载数据源失败';
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = '网络请求失败，可能后台服务器未启动或网络连接问题';
            } else if (error.name === 'SyntaxError') {
                errorMessage = '解析后台返回的JSON数据失败，数据格式不正确';
            } else {
                errorMessage = `${errorMessage}: ${error.message}`;
            }
            
            // 存储错误信息
            this.#lastError = errorMessage;
            
            console.error(errorMessage, error);
            return false;
        }
    }

    #initializeData() {
        // 初始化货位数据
        this.#config.dataSource.storage.locations.forEach(location => {
            this.#locationMap.set(location.id, location);
        });

        // 初始化车辆数据
        this.#config.dataSource.vehicles.forEach(vehicle => {
            this.#vehicleMap.set(vehicle.id, vehicle);
        });
    }

    #startUpdates() {
        // 每秒更新一次车辆数据
        this.#updateInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.#apiBaseUrl}/vehicles`);
                const vehicles = await response.json();
                
                vehicles.forEach(vehicle => {
                    this.#vehicleMap.set(vehicle.id, vehicle);
                });
            } catch (error) {
                console.error('更新车辆数据失败:', error);
            }
        }, 1000);
    }

    // 获取所有货位
    getAllLocations() {
        return Array.from(this.#locationMap.values());
    }

    // 获取所有车辆
    getAllVehicles() {
        return Array.from(this.#vehicleMap.values());
    }

    // 根据ID获取货位
    getLocationById(id) {
        return this.#locationMap.get(id);
    }

    // 根据ID获取车辆
    getVehicleById(id) {
        return this.#vehicleMap.get(id);
    }

    // 获取通信配置
    getCommunicationConfig() {
        return this.#config.communication;
    }

    // 更新车辆位置和状态
    async updateVehicleStatus(id, status, position) {
        try {
            const response = await fetch(`${this.#apiBaseUrl}/vehicles/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status, position })
            });
            
            if (response.ok) {
                const updatedVehicle = await response.json();
                this.#vehicleMap.set(id, updatedVehicle);
                return true;
            }
            return false;
        } catch (error) {
            console.error('更新车辆状态失败:', error);
            return false;
        }
    }

    // 清理资源
    destroy() {
        if (this.#updateInterval) {
            clearInterval(this.#updateInterval);
            this.#updateInterval = null;
        }
    }

    // 获取最后一次错误信息
    getLastError() {
        return this.#lastError;
    }
} 