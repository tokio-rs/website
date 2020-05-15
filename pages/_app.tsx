import '../styles/styles.scss'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faGithub, faDiscord, faTwitter } from '@fortawesome/free-brands-svg-icons'

library.add(faGithub, faDiscord, faTwitter)

function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />
}

// Only uncomment this method if you have blocking data requirements for
// every single page in your application. This disables the ability to
// perform automatic static optimization, causing every page in your app to
// be server-side rendered.
//
// MyApp.getInitialProps = async (appContext) => {
//   // calls page's `getInitialProps` and fills `appProps.pageProps`
//   const appProps = await App.getInitialProps(appContext);
//
//   return { ...appProps }
// }

export default MyApp