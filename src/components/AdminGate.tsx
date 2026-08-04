import { useState } from 'react'

interface AdminGateProps {
  password: string
  onUnlock: () => void
  onClose: () => void
}

const PIN_LENGTH = 4

// 密码用点按数字键盘,不用系统键盘——万一童童长按到了这里,她只会看到一串数字,
// 不会触发手机的输入法(那反而更显眼)
function AdminGate({ password, onUnlock, onClose }: AdminGateProps) {
  const [digits, setDigits] = useState('')
  const [wrong, setWrong] = useState(false)

  function press(d: string) {
    setWrong(false)
    const next = (digits + d).slice(0, PIN_LENGTH)
    setDigits(next)
    if (next.length === PIN_LENGTH) {
      if (next === password) {
        onUnlock()
      } else {
        setWrong(true)
        setTimeout(() => setDigits(''), 400)
      }
    }
  }

  return (
    <div className="admin-ui fixed inset-0 z-30 flex items-center justify-center bg-ink/80">
      <div className="flex w-72 flex-col items-center gap-4 rounded-3xl bg-sand px-6 py-6 shadow-lg">
        <p className="font-kuaile text-lg text-ink/70">爸爸的密码</p>
        <div className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full border-2 border-ink/60 ${
                i < digits.length ? 'bg-ink/60' : 'bg-transparent'
              } ${wrong ? 'border-heart' : ''}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', ''].map((d, i) =>
            d ? (
              <button
                key={i}
                type="button"
                onClick={() => press(d)}
                className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white/80 font-kuaile text-xl text-ink shadow-sm active:scale-95"
              >
                {d}
              </button>
            ) : (
              <span key={i} />
            ),
          )}
        </div>
        <button type="button" onClick={onClose} className="font-wenkai text-sm text-ink/50">
          取消
        </button>
      </div>
    </div>
  )
}

export default AdminGate
