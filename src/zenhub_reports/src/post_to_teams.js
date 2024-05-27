const axios = require('axios')

const formattedCardPayload = {
  type: 'message',
  attachments: [
    {
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        type: 'AdaptiveCard',
        version: '1.2',
        body: [
          {
            type: 'TextBlock',
            text: 'Submitted response: TEST'
          }
        ]
      }
    }
  ]
}

const webhookUrl =
  'https://verisk.webhook.office.com/webhookb2/a9380ca5-b775-432d-a35c-d7c0b976d157@3b07dc1f-22e7-4be1-ac66-a88bf3550222/IncomingWebhook/0af76c188e9947588eae47679a781340/9f3a21e6-f066-427f-af5e-1a5ce12e0b27'

axios
  .post(webhookUrl, formattedCardPayload)
  .then(res => {
    console.log(`statusCode: ${res.status}`)
    console.log(res)
  })
  .catch(error => {
    console.error(error)
  })
