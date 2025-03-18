const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 固定配置模板，按你提供的示例格式填写
const fixedConfig = {
  proxies: [
    // 如果你有预置的节点，也可以写在这里，否则可以保持为空数组
  ],
  dns: {
    enable: true,
    listen: '0.0.0.0:1053',
    ipv6: true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '28.0.0.1/8',
    'fake-ip-filter': [
      '*',
      '+.lan'
    ],
    'default-nameserver': [
      '223.5.5.5',
      '223.6.6.6'
    ],
    nameserver: [
      'https://223.5.5.5/dns-query#h3=true',
      'https://223.6.6.6/dns-query#h3=true'
    ]
  },
  'rule-providers': {
    private: {
      url: 'https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml',
      path: './ruleset/private.yaml',
      behavior: 'domain',
      interval: 86400,
      format: 'yaml',
      type: 'http'
    },
    cn_domain: {
      url: 'https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.yaml',
      path: './ruleset/cn_domain.yaml',
      behavior: 'domain',
      interval: 86400,
      format: 'yaml',
      type: 'http'
    },
    Spotify_domain: {
      url: 'https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Spotify/Spotify.yaml',
      path: './ruleset/Spotify_domain.yaml',
      behavior: 'classical',
      interval: 86400,
      format: 'yaml',
      type: 'http'
    },
    // 可根据需要添加其他 rule-providers
  },
  'proxy-groups': [
    {
      icon: 'https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/Loon.png',
      'include-all': true,
      'exclude-filter': '(?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置',
      name: 'PAKO',
      type: 'select',
      proxies: [
        'AUTO',
        'HK AUTO',
        'SG AUTO',
        'JP AUTO',
        'US AUTO',
        'KR AUTO',
        'GA AUTO'
      ]
    },
    {
      icon: 'https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Auto.png',
      'include-all': true,
      'exclude-filter': '(?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置',
      name: 'AUTO',
      type: 'select',
      interval: 3000
    },
    // 根据你的示例添加其他 proxy-groups
  ],
  rules: [
    'DOMAIN-KEYWORD,vidhub1.cc,DIRECT',
    'DOMAIN,domainname,PAKO',
    'RULE-SET,Spotify_domain,Spotify',
    'RULE-SET,youtube_domain,Youtube',
    'RULE-SET,copilot,AIGC',
    'RULE-SET,claude,AIGC',
    'RULE-SET,bard,AIGC',
    'RULE-SET,openai,AIGC',
    'DOMAIN-SUFFIX,chat.openai.com,AIGC',
    'DOMAIN-SUFFIX,chatgpt.com,AIGC',
    'DOMAIN-SUFFIX,api.openai.com,AIGC',
    'DOMAIN-SUFFIX,auth0.com,AIGC',
    'RULE-SET,google_domain,Google',
    'RULE-SET,google_ip,Google',
    'RULE-SET,telegram_domain,Telegram',
    'RULE-SET,telegram_ip,Telegram',
    'RULE-SET,private,PAKO',
    'RULE-SET,netflix_domain,Netflix',
    'RULE-SET,emby_domain,Netflix',
    'RULE-SET,bing,Google',
    'RULE-SET,steam,Steam',
    'RULE-SET,geolocation-!cn,PAKO',
    'RULE-SET,cn_domain,Mainland',
    'RULE-SET,cn_ip,Mainland',
    'RULE-SET,dns_leak,PAKO',
    'GEOIP,CN,Mainland',
    'MATCH,PAKO'
  ]
};

app.get('/', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');
  
  try {
    // 获取订阅数据
    const response = await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } });
    let decodedData = response.data;
    
    // 尝试 Base64 解码
    try {
      const tempDecoded = Buffer.from(decodedData, 'base64').toString('utf-8');
      if (tempDecoded.includes('proxies:') || tempDecoded.includes('port:')) {
        decodedData = tempDecoded;
      }
    } catch (e) {
      // Base64解码失败时，直接使用原始数据
    }
    
    // 解析订阅数据：支持标准 YAML 格式或自定义以“|”分隔的格式
    let subConfig;
    if (decodedData.includes('proxies:')) {
      subConfig = yaml.load(decodedData);
    } else {
      subConfig = {
        proxies: decodedData.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const parts = line.split('|');
            return parts.length >= 5 ? {
              name: `${parts[1]}-${parts[2]}`,
              type: parts[0] || 'ss',
              server: parts[1],
              port: parseInt(parts[2]),
              cipher: parts[3] || 'chacha20-ietf-poly1305',
              password: parts[4],
              udp: true
            } : null;
          })
          .filter(Boolean)
      };
    }
    
    // 合并订阅中的节点信息到固定配置中，不做任何覆盖操作，只是追加
    if (subConfig?.proxies?.length > 0) {
      fixedConfig.proxies = fixedConfig.proxies.concat(subConfig.proxies);
      
      // 根据代理名称去重（保留第一次出现的节点）
      const seen = new Map();
      fixedConfig.proxies = fixedConfig.proxies.filter(proxy => {
        if (!proxy?.name) return false;
        if (!seen.has(proxy.name)) {
          seen.set(proxy.name, true);
          return true;
        }
        return false;
      });
    }
    
    // 输出的 YAML 格式严格按照模板来，包括 dns、rule-providers、proxy-groups、rules 等部分
    res.set('Content-Type', 'text/yaml');
    res.send(yaml.dump(fixedConfig));
  } catch (error) {
    res.status(500).send(`转换失败：${error.message}`);
  }
});

module.exports = app;
