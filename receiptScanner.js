const ANTHROPIC_API_KEY = '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'

export const scanReceipt = async (base64Image) => {
  try {
    console.log('Starting receipt scan...')
    console.log('Image data length:', base64Image?.length)

    if (!base64Image) {
      return { success: false, error: 'No image data received' }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Look at this receipt image carefully. Extract the transaction details and respond ONLY with a valid JSON object — no markdown, no backticks, no extra text.

JSON format:
{
  "amount": number (the final total amount paid, just the number like 24.99),
  "payee": string (the store or business name from the top of the receipt),
  "date": string (in YYYY-MM-DD format, or today's date if not visible),
  "category": string (pick one: Housing, Food, Transport, Healthcare, Education, Entertainment, Shopping, Utilities, Travel, Equipment, Medical, Agent fees, Tax payment),
  "description": string (3-5 words describing what was bought),
  "confidence": string (high, medium, or low — how clearly you could read the receipt)
}

If the image is blurry or hard to read, still try your best and set confidence to low. Always return valid JSON.`,
              },
            ],
          },
        ],
      }),
    })

    console.log('Response status:', response.status)
    const data = await response.json()
    console.log('Full API response:', JSON.stringify(data))

    if (data?.error) {
      console.log('API error:', data.error.message)
      return { success: false, error: data.error.message }
    }

    if (data?.content?.[0]?.text) {
      const rawText = data.content[0].text
      console.log('Raw text from Claude:', rawText)

      const clean = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim()

      console.log('Cleaned text:', clean)

      const parsed = JSON.parse(clean)
      console.log('Parsed data:', parsed)

      return { success: true, data: parsed }
    }

    return { success: false, error: 'No response from Claude' }

  } catch (error) {
    console.log('Receipt scan error:', error.message)
    return { success: false, error: error.message }
  }
}