export const awsConfig = {
  Auth: {
    region: 'eu-west-2',
    userPoolId: 'eu-west-2_vqoPLIFOP',
    userPoolWebClientId: '34vqadlovsd1oa63eu4qn6prb2',
    mandatorySignIn: false,
    oauth: {
      domain: process.env.REACT_APP_COGNITO_DOMAIN,
      scope: ['email', 'profile', 'openid'],
      redirectSignIn: process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/dashboard'
        : 'https://spendulon.com/dashboard',
      redirectSignOut: process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000/'
        : 'https://spendulon.com/',
      responseType: 'code'
    }
  }
};