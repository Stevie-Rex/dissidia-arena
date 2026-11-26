/** The game-icons.net credit (CC BY 3.0 asks for it wherever the icons show). One wording for the sidebar foot and the phone footer. */
export default function IconCredit({ className, linkClassName }: { className?: string; linkClassName?: string }) {
  return (
    <p className={className}>
      Icons by Lorc and Delapouite from{' '}
      <a href="https://game-icons.net" className={linkClassName}>
        game-icons.net
      </a>
      ,{' '}
      <a href="https://creativecommons.org/licenses/by/3.0/" className={linkClassName}>
        CC BY 3.0
      </a>
      .
    </p>
  )
}
