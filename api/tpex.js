// api/tpex.js - Vercel Serverless Function
// 解決 TPEx 三大法人 CORS 問題的後端中繼

export default async function handler(req, res) {
  // CORS headers - 允許你的 GitHub Pages 網域呼叫
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { date, type } = req.query;
  // type: 'inst' = 三大法人, 'price' = 個股收盤價
  
  if (!date) {
    return res.status(400).json({ error: 'date parameter required (format: 114/05/27)' });
  }

  try {
    let targetUrl;
    
    if (type === 'price') {
      // 上櫃個股日收盤：用於備援價格抓取
      const { stockno } = req.query;
      if (!stockno) return res.status(400).json({ error: 'stockno required' });
      targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&d=${date}&stkno=${stockno}&o=json`;
    } else {
      // 預設：三大法人 (全市場上櫃)
      targetUrl = `https://www.tpex.org.tw/web/stock/3insti/daily_trade/3itrade_hedge_result.php?l=zh-tw&d=${date}&se=EW&s=0,asc&o=json`;
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tpex.org.tw/',
        'Accept': 'application/json, text/javascript, */*',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `TPEx returned ${response.status}`,
        url: targetUrl 
      });
    }

    const data = await response.json();
    
    // 快取 1 小時（盤後資料不會變動）
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ 
      error: err.message,
      hint: 'TPEx server may be down or blocking requests'
    });
  }
}
