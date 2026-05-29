// api/tpex.js - TPEx 專用 Vercel Serverless Proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { date, type, stockno, codes } = req.query;
  // codes = 逗號分隔的純代號字串，e.g. "6261,3260,5289"
  const codesSet = codes ? new Set(codes.split(',').map(c => c.trim()).filter(Boolean)) : null;

  if (!date) {
    return res.status(400).json({ error: 'date parameter required' });
  }

  // ★ date 內的斜線必須編碼，否則 TPEx 回傳「參數輸入錯誤」
  const encodedDate = encodeURIComponent(date);

  try {
    let targetUrl;

    if (type === 'price') {
      if (!stockno) return res.status(400).json({ error: 'stockno required' });
      targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&d=${encodedDate}&stkno=${stockno}&o=json`;

    } else if (type === 'monthly') {
      if (!stockno) return res.status(400).json({ error: 'stockno required' });
      targetUrl = `https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock/exchange?date=${encodedDate}&stockCode=${stockno}&response=json`;

    } else {
      // 預設：三大法人全市場上櫃
      targetUrl = `https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&d=${encodedDate}&se=EW&s=0,asc&o=json`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tpex.org.tw/',
        'Accept': 'application/json, text/javascript, */*',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `TPEx returned ${response.status}`,
        url: targetUrl
      });
    }

    const data = await response.json();
    // ★ 上櫃三大法人過濾：只回傳前端需要的持倉/觀察股，大幅縮減 payload
    if (!type && codesSet && codesSet.size > 0 && Array.isArray(data?.aaData)) {
      data.aaData = data.aaData.filter(row => codesSet.has(String(row[0] || '').trim()));
    }
    // ★ 完全禁用 CDN 快取，確保每次都拿到當日最新資料
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      hint: 'TPEx server may be down or blocking requests'
    });
  }
}
