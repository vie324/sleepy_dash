export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY が設定されていません' });
  }

  const { metrics, sleepRisk, viewMode, customerName } = req.body;

  if (!metrics || !sleepRisk) {
    return res.status(400).json({ error: '分析データが不足しています' });
  }

  const prompt = `あなたは睡眠整体院「SLEEPY」の姿勢分析AIアシスタントです。
以下の姿勢分析結果に基づき、お客様への具体的なフィードバックを日本語で提供してください。
専門的かつ分かりやすく、整体師が使える実践的な内容にしてください。

【お客様名】${customerName || '未入力'}
【撮影モード】${viewMode === 'front' ? '正面（肩・骨盤バランス評価）' : '側面（ストレートネック・猫背評価）'}
【総合スコア】${metrics.totalScore}/100点
【各メトリクス】
${metrics.items.map(i => `- ${i.name}: 計測値 ${i.angle}${i.unit}（スコア: ${i.score}/100, 理想範囲: ${i.ideal}）`).join('\n')}
【睡眠リスク】${sleepRisk.riskLabel}（レベル${sleepRisk.riskLevel}/4）
${sleepRisk.risks && sleepRisk.risks.length > 0 ? '【リスク要因】\n' + sleepRisk.risks.map(r => `- ${r.metric}（${r.score}点）: ${r.impact}`).join('\n') : ''}

以下の形式で回答してください（マークダウン不要、プレーンテキストで）:

■ 姿勢の状態
（現在の姿勢の状態を2-3文で簡潔にまとめる）

■ 睡眠への影響
（姿勢の問題が睡眠にどう影響するか、改善すべきポイントを箇条書き3つ以内）

■ おすすめストレッチ・エクササイズ
（自宅でできる具体的な改善法を2-3個、各30字程度で）

■ 施術者へのメモ
（整体師が施術時に注目すべきポイントを1-2文で）`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: 'Claude APIからエラーが返されました' });
    }

    const data = await response.json();
    return res.status(200).json({
      feedback: data.content[0].text
    });
  } catch (e) {
    console.error('Posture feedback error:', e);
    return res.status(500).json({ error: 'AIフィードバックの生成に失敗しました' });
  }
}
