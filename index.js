const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 配置信息 - 使用环境变量更安全
const FIXED_CONFIG_URL = process.env.FIXED_CONFIG_URL || 'https://raw.githubusercontent.com/6otho/Yaml-PaKo/refs/heads/main/PAKO_urltest-CaiSe.yaml';
const SECRET_KEY = process.env.SECRET_KEY || 'default_secret_here';

// 移除 os 模块依赖（Vercel 无服务器环境不支持）
// 移除端口监听（Vercel 自动分配端口）

app.get('/', async (req, res) => {
    const subUrl = req.query.url;
    const domainPrefix = req.query.domain;
    
    if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');
    
    try {
        // 加载模板配置
        const fixedConfig = await loadYaml(FIXED_CONFIG_URL);
        
        // 确保proxies字段存在
        if (!Array.isArray(fixedConfig.proxies)) fixedConfig.proxies = [];
        
        // 获取订阅数据（添加超时限制）
        const response = await axios.get(subUrl, { 
            headers: { 'User-Agent': 'Clash Verge' },
            timeout: 8000 // 添加超时防止卡死
        });
        
        let decodedData = response.data;
        try {
            const tempDecoded = Buffer.from(decodedData, 'base64').toString('utf-8');
            if (tempDecoded.includes('proxies:')) decodedData = tempDecoded;
        } catch (e) {}

        // 解析订阅数据
        let subConfig = parseSubscription(decodedData);

        // 核心逻辑：混合模板与订阅代理
        if (subConfig?.proxies?.length > 0) {
            mergeConfigs(fixedConfig, subConfig);
        }

        // 域名前置处理
        if (domainPrefix) {
            applyDomainPrefix(fixedConfig, domainPrefix);
        }

        // 添加流量统计支持
        enableTrafficStats(fixedConfig);

        res.set('Content-Type', 'text/yaml');
        res.send(yaml.dump(fixedConfig));
    } catch (error) {
        console.error('处理失败:', error);
        res.status(500).send(`转换失败：${error.message}`);
    }
});

// 实时流量API端点
app.get('/traffic', (req, res) => {
    const auth = req.headers.authorization;
    
    if (!auth || auth !== `Bearer ${SECRET_KEY}`) {
        return res.status(401).json({ error: '未授权访问' });
    }
    
    // Vercel 无服务器环境无法保持状态，返回示例数据
    res.json({
        status: "Vercel无服务器环境无法保持实时状态",
        suggestion: "请使用Clash客户端内置的流量统计功能",
        example_data: {
            "proxy1": { up: 1024, down: 2048 },
            "proxy2": { up: 512, down: 4096 }
        }
    });
});

// 辅助函数：加载YAML配置
async function loadYaml(url) {
    try {
        const response = await axios.get(url, { 
            headers: { 'User-Agent': 'Clash Verge' },
            timeout: 10000
        });
        return yaml.load(response.data);
    } catch (error) {
        console.error('加载模板配置失败:', error);
        // 返回空配置防止崩溃
        return { proxies: [], 'proxy-groups': [] };
    }
}

// 辅助函数：解析订阅数据
function parseSubscription(data) {
    if (data.includes('proxies:')) {
        try {
            return yaml.load(data);
        } catch (e) {
            console.error('解析YAML订阅失败:', e);
            return { proxies: [] };
        }
    }
    
    try {
        return {
            proxies: data.split('\n')
                .filter(line => line.trim())
                .map(line => {
                    const parts = line.split('|');
                    if (parts.length < 5) return null;
                    
                    return {
                        name: `${parts[1]}-${parts[2]}`,
                        type: parts[0] || 'ss',
                        server: parts[1],
                        port: parseInt(parts[2]),
                        cipher: parts[3] || 'aes-256-gcm',
                        password: parts[4]
                    };
                })
                .filter(Boolean)
        };
    } catch (e) {
        console.error('解析自定义订阅失败:', e);
        return { proxies: [] };
    }
}

// 辅助函数：合并配置
function mergeConfigs(fixedConfig, subConfig) {
    const templateProxies = [...fixedConfig.proxies];
    
    if (templateProxies.length > 0 && subConfig.proxies.length > 0) {
        const subProxy = subConfig.proxies[0];
        templateProxies[0] = {
            ...templateProxies[0],
            server: subProxy.server,
            port: subProxy.port || templateProxies[0].port,
            password: subProxy.password || templateProxies[0].password,
            cipher: subProxy.cipher || templateProxies[0].cipher,
            type: subProxy.type || templateProxies[0].type
        };
    }

    const mergedProxies = [...templateProxies, ...subConfig.proxies];
    const seen = new Map();
    
    fixedConfig.proxies = mergedProxies.filter(proxy => {
        if (!proxy || !proxy.name) return false;
        if (!seen.has(proxy.name)) {
            seen.set(proxy.name, true);
            return true;
        }
        return false;
    });

    // 更新代理组
    if (Array.isArray(fixedConfig['proxy-groups'])) {
        fixedConfig['proxy-groups'] = fixedConfig['proxy-groups'].map(group => {
            if (group.name === 'PROXY' && Array.isArray(group.proxies)) {
                return {
                    ...group,
                    proxies: group.proxies.filter(name => 
                        fixedConfig.proxies.some(p => p.name === name)
                    )
                };
            }
            return group;
        });
    }
}

// 辅助函数：应用域名前置
function applyDomainPrefix(config, domainPrefix) {
    // 1. 前置域名到代理名称
    if (Array.isArray(config.proxies)) {
        config.proxies.forEach(proxy => {
            if (proxy && proxy.name) {
                proxy.name = `${domainPrefix}-${proxy.name}`;
            }
        });
    }

    // 2. 更新代理组中的引用
    if (Array.isArray(config['proxy-groups'])) {
        config['proxy-groups'].forEach(group => {
            if (Array.isArray(group.proxies)) {
                group.proxies = group.proxies.map(name => {
                    // 跳过DIRECT和REJECT等特殊值
                    if (['DIRECT', 'REJECT', 'GLOBAL'].includes(name)) return name;
                    return `${domainPrefix}-${name}`;
                });
            }
        });
    }

    // 3. 更新规则中的代理引用
    if (Array.isArray(config.rules)) {
        config.rules = config.rules.map(rule => {
            const parts = rule.split(',');
            if (parts.length === 3) {
                // 格式: 类型,参数,代理
                return `${parts[0]},${parts[1]},${domainPrefix}-${parts[2]}`;
            }
            return rule;
        });
    }
}

// 辅助函数：启用流量统计
function enableTrafficStats(config) {
    // 1. 启用流量统计API
    config['external-controller'] = '0.0.0.0:9090';
    config.secret = SECRET_KEY;
    
    // 2. 添加流量统计标签功能
    config['traffic-label'] = true;
    
    // 3. 为每个代理添加流量标签
    if (Array.isArray(config.proxies)) {
        config.proxies.forEach(proxy => {
            if (proxy && !proxy['traffic-label']) {
                proxy['traffic-label'] = `PROXY_${proxy.server || 'default'}`;
            }
        });
    }
    
    // 4. 添加流量统计代理组
    if (Array.isArray(config['proxy-groups'])) {
        const hasTrafficGroup = config['proxy-groups'].some(g => g.name === '流量监控');
        
        if (!hasTrafficGroup) {
            config['proxy-groups'].unshift({
                name: '流量监控',
                type: 'select',
                proxies: ['DIRECT', ...(config.proxies || []).map(p => p.name)]
            });
        }
    }
    
    // 5. 添加流量统计规则
    const trafficRule = 'AND,(AND,(DST-PORT,443),(NETWORK,TCP)),流量监控';
    if (Array.isArray(config.rules)) {
        config.rules.unshift(trafficRule);
    } else {
        config.rules = [trafficRule];
    }
}

// 导出为Vercel Serverless Function
module.exports = app;
