class ScadaCharts {
    constructor() {
        this.charts = {};
        this.data = null;
        
        // 初始化
        this.init();
    }
    
    // 初始化
    async init() {
        try {
            // 加载初始数据
            await this.loadData();
            
            // 初始化图表
            this.initCharts();
            
            // 设置定时更新
            setInterval(() => this.updateData(), 5000); // 每5秒更新一次
        } catch (error) {
            console.error('初始化失败:', error);
        }
    }
    
    // 加载数据
    async loadData() {
        try {
            const response = await fetch('data/mock.json');
            this.data = await response.json();
            console.log('数据加载成功');
        } catch (error) {
            console.error('数据加载失败:', error);
        }
    }
    
    // 更新数据和图表
    async updateData() {
        try {
            await this.loadData();
            this.updateCharts();
            this.updateStatus();
            console.log('数据更新成功');
        } catch (error) {
            console.error('数据更新失败:', error);
        }
    }
    
    // 更新状态显示
    updateStatus() {
        if (!this.data) return;
        
        // 更新AMR状态
        const status = this.data.amr_status;
        document.querySelectorAll('#amr-status .status-box').forEach(box => {
            const type = box.querySelector('p').textContent;
            const value = box.querySelector('h3');
            switch(type) {
                case '总数': value.innerHTML = `${status.total}<span>台</span>`; break;
                case '投入': value.innerHTML = `${status.active}<span>台</span>`; break;
                case '离线': value.innerHTML = `${status.offline}<span>台</span>`; break;
                case '运送': value.innerHTML = `${status.delivering}<span>台</span>`; break;
                case '充电': value.innerHTML = `${status.charging}<span>台</span>`; break;
                case '空闲': value.innerHTML = `${status.idle}<span>台</span>`; break;
            }
        });
        
        // 更新任务完成率
        const completion = this.data.task_completion;
        document.querySelector('#task-completion-rate .gauge-value').textContent = completion.rate;
        document.querySelectorAll('#task-completion-rate .task-item').forEach(item => {
            const label = item.querySelector('.label').textContent;
            const value = item.querySelector('.value');
            if (label === '已完成') {
                value.innerHTML = `${completion.completed}<span class="unit">个</span>`;
            } else if (label === '任务总数量') {
                value.innerHTML = `${completion.total}<span class="unit">个</span>`;
            }
        });
        
        // 更新任务执行情况表格
        const taskTable = document.getElementById('task-table');
        if (taskTable) {
            let html = '<table><thead><tr><th>任务ID</th><th>AMR</th><th>开始时间</th><th>状态</th><th>耗时</th></tr></thead><tbody>';
            this.data.task_execution.tasks.forEach(task => {
                html += `<tr>
                    <td>${task.id}</td>
                    <td>${task.amr}</td>
                    <td>${task.start_time}</td>
                    <td>${task.status}</td>
                    <td>${task.duration}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            taskTable.innerHTML = html;
        }
    }
    
    // 初始化所有图表
    initCharts() {
        try {
            console.log('开始初始化图表...');
            
            // 为每个图表容器创建canvas元素
            this.createCanvas('daily-task-chart');
            this.createCanvas('daily-rate-chart');
            this.createCanvas('weekly-trend-chart');
            this.createCanvas('weekly-comparison-chart');
            this.createCanvas('weekly-task-chart');
            this.createCanvas('completion-gauge');
            
            console.log('Canvas元素创建完成');
            
            // 初始化所有图表
            this.createDailyTaskChart();
            this.createDailyRateChart();
            this.createWeeklyTrendChart();
            this.createCompletionGauge();
            this.createWeeklyComparisonChart();
            this.createWeeklyTaskChart();
            
            console.log('图表初始化完成');
            
            // 添加窗口大小变化监听
            window.addEventListener('resize', () => {
                this.handleResize();
            });
        } catch (error) {
            console.error('图表初始化失败:', error);
        }
    }
    
    // 处理窗口大小变化
    handleResize() {
        try {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.resize === 'function') {
                    chart.resize();
                }
            });
        } catch (error) {
            console.error('图表重置大小失败:', error);
        }
    }
    
    // 创建canvas元素
    createCanvas(containerId) {
        try {
            const container = document.getElementById(containerId);
            if (container) {
                // 清空容器
                container.innerHTML = '';
                
                const canvas = document.createElement('canvas');
                container.appendChild(canvas);
                console.log(`Canvas创建成功: ${containerId}`);
                return canvas;
            } else {
                console.error(`找不到容器: ${containerId}`);
            }
        } catch (error) {
            console.error(`创建Canvas失败 ${containerId}:`, error);
        }
        return null;
    }
    
    // 创建当日接单数量图表
    createDailyTaskChart() {
        const container = document.getElementById('daily-task-chart');
        if (!container || !container.firstChild) return;
        
        const ctx = container.firstChild.getContext('2d');
        
        // 生成随机数据
        const hours = Array.from({length: 24}, (_, i) => `${i}`);
        const data = Array.from({length: 24}, () => Math.floor(Math.random() * 50));
        
        // 找到最大值并高亮
        const maxIndex = data.indexOf(Math.max(...data));
        const backgroundColors = data.map((_, index) => 
            index === maxIndex ? '#3ddc84' : 'rgba(61, 220, 132, 0.4)'
        );
        
        // 创建图表
        this.charts.dailyTask = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [{
                    label: '每小时接单数',
                    data: data,
                    backgroundColor: backgroundColors,
                    borderColor: '#3ddc84',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 12
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 25, 32, 0.9)',
                        borderColor: '#3e4756',
                        borderWidth: 1,
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        displayColors: false,
                        callbacks: {
                            title: function(tooltipItems) {
                                return `${tooltipItems[0].label}:00 - ${Number(tooltipItems[0].label) + 1}:00`;
                            },
                            label: function(context) {
                                return `接单数: ${context.raw}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 创建当日执行效率图表
    createDailyRateChart() {
        const container = document.getElementById('daily-rate-chart');
        if (!container || !container.firstChild) return;
        
        const ctx = container.firstChild.getContext('2d');
        
        // 生成随机数据
        const labels = ['SFL-CD020', 'SFL-CD014', 'AMR-800K', 'AMR-900J', 'AMR-700T', 'SFL-CD019', 'AMR-850X'];
        const data = labels.map(() => Math.floor(Math.random() * 20) + 80); // 80-100%
        
        // 创建图表
        this.charts.dailyRate = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '执行效率',
                    data: data,
                    backgroundColor: data.map(value => 
                        value >= 90 ? 'rgba(61, 220, 132, 0.7)' : 
                        value >= 80 ? 'rgba(33, 150, 243, 0.7)' : 
                        'rgba(255, 152, 0, 0.7)'
                    ),
                    borderColor: data.map(value => 
                        value >= 90 ? '#3ddc84' : 
                        value >= 80 ? '#2196f3' : 
                        '#ff9800'
                    ),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: {
                        beginAtZero: true,
                        max: 100,
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 25, 32, 0.9)',
                        borderColor: '#3e4756',
                        borderWidth: 1,
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `执行效率: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 创建近一周执行效率趋势图表
    createWeeklyTrendChart() {
        const container = document.getElementById('weekly-trend-chart');
        if (!container || !container.firstChild) return;
        
        const ctx = container.firstChild.getContext('2d');
        
        // 生成近7天的日期标签
        const days = [6, 5, 4, 3, 2, 1, 0].map(dayOffset => {
            const date = new Date();
            date.setDate(date.getDate() - dayOffset);
            return `${date.getMonth() + 1}.${date.getDate()}`;
        });
        
        // 生成随机数据
        const data = days.map(() => Math.floor(Math.random() * 40) + 60); // 60-100%
        
        // 创建图表
        this.charts.weeklyTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: '执行效率',
                    data: data,
                    backgroundColor: 'rgba(61, 220, 132, 0.2)',
                    borderColor: '#3ddc84',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#3ddc84',
                    pointBorderColor: '#1a1f25',
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        min: 50,
                        max: 120,
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 25, 32, 0.9)',
                        borderColor: '#3e4756',
                        borderWidth: 1,
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `执行效率: ${context.raw}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 创建完成率仪表盘
    createCompletionGauge() {
        const container = document.getElementById('completion-gauge');
        if (!container || !container.firstChild) return;
        
        const canvas = container.firstChild;
        const ctx = canvas.getContext('2d');
        
        const gaugeValue = 75; // 完成率
        
        // 创建仪表盘图表
        this.charts.gauge = new Chart(ctx, {
            type: 'doughnut',
            data: {
                datasets: [{
                    data: [gaugeValue, 100 - gaugeValue],
                    backgroundColor: [
                        '#3ddc84',
                        'rgba(62, 71, 86, 0.5)'
                    ],
                    borderWidth: 0,
                    circumference: 180,
                    rotation: 270
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                }
            }
        });
    }
    
    // 创建任务近一周完成异常对比图表
    createWeeklyComparisonChart() {
        const container = document.getElementById('weekly-comparison-chart');
        if (!container || !container.firstChild) {
            console.error('找不到weekly-comparison-chart容器或其canvas元素');
            return;
        }
        
        const ctx = container.firstChild.getContext('2d');
        
        // 生成近7天的日期标签
        const days = [6, 5, 4, 3, 2, 1, 0].map(dayOffset => {
            const date = new Date();
            date.setDate(date.getDate() - dayOffset);
            return `${date.getMonth() + 1}.${date.getDate()}`;
        });
        
        // 生成随机数据
        const completedData = days.map(() => Math.floor(Math.random() * 8) + 5); // 5-12
        const abnormalData = days.map(() => Math.floor(Math.random() * 4) + 1); // 1-4
        
        // 创建图表
        this.charts.weeklyComparison = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: days,
                datasets: [
                    {
                        label: '完成',
                        data: completedData,
                        backgroundColor: 'rgba(61, 220, 132, 0.7)',
                        borderColor: '#3ddc84',
                        borderWidth: 1,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    },
                    {
                        label: '异常',
                        data: abnormalData,
                        backgroundColor: 'rgba(244, 67, 54, 0.7)',
                        borderColor: '#f44336',
                        borderWidth: 1,
                        barPercentage: 0.6,
                        categoryPercentage: 0.7
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 20,
                        bottom: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            padding: 5,
                            font: {
                                size: 10
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            padding: 5,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e0e0e0',
                            boxWidth: 12,
                            boxHeight: 12,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 25, 32, 0.9)',
                        borderColor: '#3e4756',
                        borderWidth: 1,
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        titleFont: {
                            size: 12
                        },
                        bodyFont: {
                            size: 11
                        },
                        padding: 8
                    }
                }
            }
        });
    }
    
    // 创建任务近一周完成情况趋势图表
    createWeeklyTaskChart() {
        const container = document.getElementById('weekly-task-chart');
        if (!container || !container.firstChild) {
            console.error('找不到weekly-task-chart容器或其canvas元素');
            return;
        }
        
        const ctx = container.firstChild.getContext('2d');
        
        // 生成近7天的日期标签
        const days = [6, 5, 4, 3, 2, 1, 0].map(dayOffset => {
            const date = new Date();
            date.setDate(date.getDate() - dayOffset);
            return `${date.getMonth() + 1}.${date.getDate()}`;
        });
        
        // 生成随机数据
        const totalData = days.map(() => Math.floor(Math.random() * 5) + 8); // 8-12
        const completedData = days.map((_, index) => {
            const total = totalData[index];
            return Math.floor(Math.random() * (total - 4)) + 4; // 至少完成4个
        });
        
        // 完成率
        const rateData = days.map((_, index) => {
            return (completedData[index] / totalData[index]) * 100;
        });
        
        // 创建图表
        this.charts.weeklyTask = new Chart(ctx, {
            type: 'line',
            data: {
                labels: days,
                datasets: [
                    {
                        label: '任务总数',
                        data: totalData,
                        backgroundColor: 'rgba(33, 150, 243, 0.3)',
                        borderColor: '#2196f3',
                        borderWidth: 2,
                        pointBackgroundColor: '#2196f3',
                        pointBorderColor: '#1a1f25',
                        pointRadius: 3,
                        fill: false,
                        yAxisID: 'y1',
                        tension: 0.1
                    },
                    {
                        label: '完成数量',
                        data: completedData,
                        backgroundColor: 'rgba(61, 220, 132, 0.3)',
                        borderColor: '#3ddc84',
                        borderWidth: 2,
                        pointBackgroundColor: '#3ddc84',
                        pointBorderColor: '#1a1f25',
                        pointRadius: 3,
                        fill: false,
                        yAxisID: 'y1',
                        tension: 0.1
                    },
                    {
                        label: '完成率',
                        data: rateData,
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        borderColor: '#ffc107',
                        borderWidth: 2,
                        pointBackgroundColor: '#ffc107',
                        pointBorderColor: '#1a1f25',
                        pointRadius: 3,
                        fill: false,
                        yAxisID: 'y2',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        left: 10,
                        right: 10,
                        top: 20,
                        bottom: 10
                    }
                },
                scales: {
                    y1: {
                        beginAtZero: true,
                        position: 'left',
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            padding: 5,
                            font: {
                                size: 10
                            }
                        }
                    },
                    y2: {
                        beginAtZero: true,
                        position: 'right',
                        max: 100,
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: '#e0e0e0',
                            padding: 5,
                            font: {
                                size: 10
                            },
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(62, 71, 86, 0.3)'
                        },
                        ticks: {
                            color: '#e0e0e0',
                            padding: 5,
                            font: {
                                size: 10
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e0e0e0',
                            boxWidth: 12,
                            boxHeight: 12,
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(20, 25, 32, 0.9)',
                        borderColor: '#3e4756',
                        borderWidth: 1,
                        titleColor: '#e0e0e0',
                        bodyColor: '#e0e0e0',
                        titleFont: {
                            size: 12
                        },
                        bodyFont: {
                            size: 11
                        },
                        padding: 8,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                if (label) {
                                    if (label === '完成率') {
                                        return `${label}: ${context.raw.toFixed(1)}%`;
                                    } else {
                                        return `${label}: ${context.raw}`;
                                    }
                                }
                                return null;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // 更新图表数据
    updateCharts() {
        if (!this.data) return;
        
        // 更新当日接单数量图表
        if (this.charts.dailyTask) {
            const hourlyData = this.data.daily_tasks.hourly_data;
            this.charts.dailyTask.data.labels = hourlyData.map(d => d.hour.toString());
            this.charts.dailyTask.data.datasets[0].data = hourlyData.map(d => d.count);
            this.charts.dailyTask.update();
        }
        
        // 更新当日执行效率图表
        if (this.charts.dailyRate) {
            const amrData = this.data.daily_efficiency.amr_data;
            this.charts.dailyRate.data.labels = amrData.map(d => d.id);
            this.charts.dailyRate.data.datasets[0].data = amrData.map(d => d.efficiency);
            this.charts.dailyRate.update();
        }
        
        // 更新近一周执行效率趋势图表
        if (this.charts.weeklyTrend) {
            const weeklyData = this.data.weekly_efficiency.daily_data;
            this.charts.weeklyTrend.data.labels = weeklyData.map(d => d.date);
            this.charts.weeklyTrend.data.datasets[0].data = weeklyData.map(d => d.efficiency);
            this.charts.weeklyTrend.update();
        }
        
        // 更新完成率仪表盘
        if (this.charts.gauge) {
            const rate = this.data.task_completion.rate;
            this.charts.gauge.data.datasets[0].data = [rate, 100 - rate];
            this.charts.gauge.update();
        }
        
        // 更新任务近一周完成异常对比图表
        if (this.charts.weeklyComparison) {
            const compData = this.data.weekly_comparison.daily_data;
            this.charts.weeklyComparison.data.labels = compData.map(d => d.date);
            this.charts.weeklyComparison.data.datasets[0].data = compData.map(d => d.completed);
            this.charts.weeklyComparison.data.datasets[1].data = compData.map(d => d.abnormal);
            this.charts.weeklyComparison.update();
        }
        
        // 更新任务近一周完成情况趋势图表
        if (this.charts.weeklyTask) {
            const trendData = this.data.weekly_task_trend.daily_data;
            this.charts.weeklyTask.data.labels = trendData.map(d => d.date);
            this.charts.weeklyTask.data.datasets[0].data = trendData.map(d => d.total);
            this.charts.weeklyTask.data.datasets[1].data = trendData.map(d => d.completed);
            this.charts.weeklyTask.data.datasets[2].data = trendData.map(d => d.rate);
            this.charts.weeklyTask.update();
        }
    }
}

// 当页面加载完成后初始化图表
document.addEventListener('DOMContentLoaded', () => {
    window.scadaCharts = new ScadaCharts();
}); 