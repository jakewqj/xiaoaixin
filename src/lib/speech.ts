// 外语短句朗读。童童靠听不靠读,所以这个只许失败得安安静静,绝不报错、绝不弹提示
export function speak(text: string, lang = 'en-US') {
  try {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel() // 别让上一句还没读完就叠一句新的
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    window.speechSynthesis.speak(utter)
  } catch {
    // 静默降级
  }
}
