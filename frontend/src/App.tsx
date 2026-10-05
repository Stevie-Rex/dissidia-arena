import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className='flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c]'>
        <h1 className='text-3xl font-bold text-blue-500'>tailwind is running</h1>
      </div>
    </>
  )
}

export default App
