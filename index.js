const express = require('express');
const axios = require('axios');
const yaml = require('js-yaml');
const app = express();

// 默认的流量订阅链接（请修改为你真实的流量信息接口地址）
const DEFAULT_TRAFFIC_URL = 'https://traffic.example.com/traffic';

// 简单生成 UUID 的函数（v4）
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
     var r = Math.random() * 16 | 0, v = c === 'x' ? r : ((r & 0x3) | 0x8);
     return v.toString(16);
  });
}

// 新版转义函数：对名称中非 ASCII 字符进行 Unicode 转义
function escapeUnicode(str) {
  return Array.from(str).map(ch => {
    const code = ch.codePointAt(0);
    if (code > 127) {
      // 如果码点小于 0x10000 用 \uXXXX，大于则用 \UXXXXXXXX
      if (code < 0x10000) {
        return "\\u" + code.toString(16).padStart(4, '0').toUpperCase();
      } else {
        return "\\U" + code.toString(16).padStart(8, '0').toUpperCase();
      }
    } else {
      return ch;
    }
  }).join('');
}

// 根据 proxies 数组构造符合要求的 YAML 字符串
// trafficData 为流量信息对象，假设格式为 { uuid1: { flow: "xxx" }, uuid2: { flow: "xxx" } }
function buildProxiesString(proxiesArray, trafficData = {}) {
  return proxiesArray.map(proxy => {
    // 若缺少 uuid，则自动生成
    if (!proxy.uuid) {
      proxy.uuid = generateUUID();
    }
    // 处理名称转义
    const name = escapeUnicode(proxy.name || '');
    const type = proxy.type || 'ss';
    const server = proxy.server || '';
    const port = proxy.port || '';
    const cipher = proxy.cipher || 'chacha20-ietf-poly1305';
    const password = proxy.password || '';
    // 如果 proxy.udp 存在，则取其值，否则默认 true
    const udp = (proxy.udp !== undefined ? proxy.udp : true);
    // 从 trafficData 中查找对应 uuid 的流量信息；若没有则用 "N/A"
    const flow = trafficData[proxy.uuid] && trafficData[proxy.uuid].flow 
                 ? `"${trafficData[proxy.uuid].flow}"`
                 : `"N/A"`;
    // 输出时严格按照要求的顺序和缩进
    return `  - name: "${name}"
    type: ${type}
    server: ${server}
    port: ${port}
    cipher: ${cipher}
    password: ${password}
    udp: ${udp}
    uuid: "${proxy.uuid}"
    flow: ${flow}`;
  }).join('\n');
}

// 固定模板字符串，除 proxies 部分外其他保持不变
// 注意模板中必须包含以 "dns:" 开头的行，作为替换标记
const configTemplate = `proxies:
  - name: "\\U0001F1ED\\U0001F1F0 香港 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5001
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1ED\\U0001F1F0 香港 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5003
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1ED\\U0001F1F0 香港 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5002
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5010
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5011
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1E8\\U0001F1F3 台湾 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5012
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5020
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5021
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1F8\\U0001F1EC 新加坡 03 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5022
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1EF\\U0001F1F5 日本 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5030
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1EF\\U0001F1F5 日本 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5031
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1FA\\U0001F1F8 美国 01 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5040
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
  - name: "\\U0001F1FA\\U0001F1F8 美国 02 IEPL「CRON」"
    type: ss
    server: work.asdwqqw.xyz
    port: 5041
    cipher: chacha20-ietf-poly1305
    password: 41692b7b-6af2-4bd5-a107-d88fd048ef15
    udp: true
dns:
  enable: true
  listen: '0.0.0.0:1053'
  ipv6: true
  enhanced-mode: fake-ip
  fake-ip-range: 28.0.0.1/8
  fake-ip-filter:
    - '*'
    - +.lan
  default-nameserver:
    - 223.5.5.5
    - 223.6.6.6
  nameserver:
    - 'https://223.5.5.5/dns-query#h3=true'
    - 'https://223.6.6.6/dns-query#h3=true'
rule-providers:
  private:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/private.yaml
    path: ./ruleset/private.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  cn_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.yaml
    path: ./ruleset/cn_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  Spotify_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Spotify/Spotify.yaml
    path: ./ruleset/Spotify_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  youtube_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/YouTube/YouTube.yaml
    path: ./ruleset/youtube_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  telegram_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/telegram.yaml
    path: ./ruleset/telegram_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  google_domain:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/6otho/yamal-pako/refs/heads/main/google.yaml
    path: ./ruleset/google_domain.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  geolocation-!cn:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/geolocation-!cn.yaml
    path: ./ruleset/geolocation-!cn.yaml
    behavior: domain
    interval: 86400
    format: yaml
    type: http
  cn_ip:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.yaml
    path: ./ruleset/cn_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  telegram_ip:
    url: >-
      https://mirror.ghproxy.com/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/telegram.yaml
    path: ./ruleset/telegram_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  google_ip:
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/google.yaml
    path: ./ruleset/google_ip.yaml
    behavior: ipcidr
    interval: 86400
    format: yaml
    type: http
  bing:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Bing/Bing.yaml
    path: ./ruleset/bing.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  copilot:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Copilot/Copilot.yaml
    path: ./ruleset/copilot.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  claude:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Claude/Claude.yaml
    path: ./ruleset/claude.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  bard:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/BardAI/BardAI.yaml
    path: ./ruleset/bard.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  openai:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI/OpenAI.yaml
    path: ./ruleset/openai.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  steam:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Steam/Steam.yaml
    path: ./ruleset/steam.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  netflix_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Netflix/Netflix.yaml
    path: ./ruleset/netflix_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  emby_domain:
    url: >-
      https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Emby/Emby.yaml
    path: ./ruleset/emby_domain.yaml
    behavior: classical
    interval: 86400
    format: yaml
    type: http
  dns_leak:
    type: http
    url: >-
      https://ghfast.top/https://raw.githubusercontent.com/6otho/loon-/refs/heads/main/Prevent_DNS_Leaks.list
    path: ./ruleset/dns_leak.yaml
    behavior: classical
    interval: 86400
    format: yaml
proxy-groups:
  - icon: >-
      https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/Loon.png
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    name: PAKO
    type: select
    proxies:
      - AUTO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Auto.png
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    name: AUTO
    type: select
    interval: 3000
  - icon: >-
      https://raw.githubusercontent.com/lige47/QuanX-icon-rule/main/icon/AppleIntelligence.png
    name: AIGC
    type: select
    proxies:
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - PAKO
      - AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Telegram.png
    name: Telegram
    type: select
    proxies:
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - PAKO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Google_Search.png
    name: Google
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Spotify.png
    name: Spotify
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Netflix_Letter.png
    name: Netflix
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/YouTube.png
    name: Youtube
    type: select
    proxies:
      - PAKO
      - HK AUTO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/Steam.png
    name: Steam
    type: select
    proxies:
      - PAKO
      - DIRECT
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: >-
      https://raw.githubusercontent.com/Koolson/Qure/master/IconSet/Color/China_Map.png
    name: Mainland
    type: select
    proxies:
      - DIRECT
      - PAKO
      - SG AUTO
      - JP AUTO
      - US AUTO
      - KR AUTO
      - GA AUTO
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/HK.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)香港|Hong Kong|HK|\\U0001F1ED\\U0001F1F0"
    name: HK AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/SG.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)新加坡|Singapore|\\U0001F1F8\\U0001F1EC"
    name: SG AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/JP.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)日本|Japan|\\U0001F1EF\\U0001F1F5"
    name: JP AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/US.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)美国|USA|\\U0001F1FA\\U0001F1F8"
    name: US AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/KR.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)韩国|South Korea|\\U0001F1F0\\U0001F1F7"
    name: KR AUTO
    type: url-test
    interval: 300
  - icon: 'https://raw.githubusercontent.com/Orz-3/mini/master/Color/XD.png'
    include-all: true
    exclude-filter: (?i)GB|Traffic|Expire|Premium|频道|订阅|ISP|流量|到期|重置
    filter: "(?i)^(?!.*(?:新加坡|Singapore|\\U0001F1F8\\U0001F1EC|日本|Japan|\\U0001F1EF\\U0001F1F5|美国|USA|\\U0001F1FA\\U0001F1F8|韩国|South Korea|\\U0001F1F0\\U0001F1F7|香港|Hong Kong|HK|\\U0001F1ED\\U0001F1F0)).*$"
    name: GA AUTO
    type: url-test
    interval: 300
rules:
  - 'DOMAIN-KEYWORD,vidhub1.cc,DIRECT'
  - 'DOMAIN,domainname,PAKO'
  - 'RULE-SET,Spotify_domain,Spotify'
  - 'RULE-SET,youtube_domain,Youtube'
  - 'RULE-SET,copilot,AIGC'
  - 'RULE-SET,claude,AIGC'
  - 'RULE-SET,bard,AIGC'
  - 'RULE-SET,openai,AIGC'
  - 'DOMAIN-SUFFIX,chat.openai.com,AIGC'
  - 'DOMAIN-SUFFIX,chatgpt.com,AIGC'
  - 'DOMAIN-SUFFIX,api.openai.com,AIGC'
  - 'DOMAIN-SUFFIX,auth0.com,AIGC'
  - 'RULE-SET,google_domain,Google'
  - 'RULE-SET,google_ip,Google'
  - 'RULE-SET,telegram_domain,Telegram'
  - 'RULE-SET,telegram_ip,Telegram'
  - 'RULE-SET,private,PAKO'
  - 'RULE-SET,netflix_domain,Netflix'
  - 'RULE-SET,emby_domain,Netflix'
  - 'RULE-SET,bing,Google'
  - 'RULE-SET,steam,Steam'
  - 'RULE-SET,geolocation-!cn,PAKO'
  - 'RULE-SET,cn_domain,Mainland'
  - 'RULE-SET,cn_ip,Mainland'
  - 'RULE-SET,dns_leak,PAKO'
  - 'GEOIP,CN,Mainland'
  - 'MATCH,PAKO'
`;

app.get('/', async (req, res) => {
  try {
    const subUrl = req.query.url;
    if (!subUrl) return res.status(400).send('请提供订阅链接，例如 ?url=你的订阅地址');

    // 1. 获取订阅数据
    let subData = (await axios.get(subUrl, { headers: { 'User-Agent': 'Clash Verge' } })).data;
    console.log('获取到订阅数据');

    // 2. 如果是 Base64 编码，则尝试解码
    try {
      const decoded = Buffer.from(subData, 'base64').toString('utf8');
      if (decoded.includes('proxies:') || decoded.includes('port:')) {
        subData = decoded;
        console.log('已进行 Base64 解码');
      }
    } catch (e) {
      console.error('Base64 解码失败：', e);
    }

    // 3. 解析 YAML 得到 proxies 数组
    let subConfig = {};
    if (subData.includes('proxies:')) {
      subConfig = yaml.load(subData);
    }
    if (!subConfig.proxies || !Array.isArray(subConfig.proxies) || subConfig.proxies.length === 0) {
      return res.status(400).send('订阅数据中未包含有效的节点信息');
    }
    console.log('解析出 proxies 数组，数量：', subConfig.proxies.length);

    // 4. 获取流量信息（如果流量订阅接口可用）
    let trafficData = {};
    try {
      const trafficResp = await axios.get(DEFAULT_TRAFFIC_URL, { headers: { 'User-Agent': 'Clash Verge' } });
      // 假设返回数据格式为 { "<uuid>": { flow: "实际流量数据" }, ... }
      trafficData = trafficResp.data;
      console.log('获取到流量数据');
    } catch (e) {
      console.error('获取流量信息失败：', e);
    }

    // 5. 根据 proxies 数组生成新的 proxies 块字符串（包含 uuid 与流量信息）
    const newProxiesStr = buildProxiesString(subConfig.proxies, trafficData);
    if (!newProxiesStr) {
      return res.status(500).send('生成节点信息字符串失败');
    }

    // 6. 检查模板中是否包含 "dns:" 行
    if (!configTemplate.includes('\ndns:')) {
      return res.status(500).send('模板格式错误，找不到 dns: 行');
    }

    // 7. 用正则替换模板中原有 proxies 块
    const outputConfig = configTemplate.replace(/^(proxies:\n)([\s\S]*?)(?=^dns:)/m, `proxies:\n${newProxiesStr}\n`);

    res.set('Content-Type', 'text/yaml');
    res.send(outputConfig);
  } catch (error) {
    console.error('整体处理出错：', error);
    res.status(500).send(`转换失败：${error.message}`);
  }
});

module.exports = app;
