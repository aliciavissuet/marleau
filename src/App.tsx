import { useEffect, useState } from 'react'
import { AudioReactiveHero } from './components/AudioReactiveHero'
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [showLoader, setShowLoader] = useState(true)

  useEffect(() => {
    const minimumLoad = window.setTimeout(() => setIsLoading(false), 950)

    return () => window.clearTimeout(minimumLoad)
  }, [])

  useEffect(() => {
    if (isLoading) return undefined

    const removeLoader = window.setTimeout(() => setShowLoader(false), 520)

    return () => window.clearTimeout(removeLoader)
  }, [isLoading])

  return (
    <>
      <main>
        <AudioReactiveHero />
      </main>
      {showLoader ? (
        <div className={isLoading ? 'page-loader' : 'page-loader is-hidden'} aria-hidden="true">
          <div className="loader-mark">MARLEΛU</div>
          <div className="loader-line" />
        </div>
      ) : null}
    </>
  )
}

export default App
