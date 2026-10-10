export function resolveCredentialLookup(username:string,email:string,adminUsername:string|undefined,adminEmail:string|undefined,adminLogin=false){
  const isAdminUsername=adminLogin||!!username&&!!adminUsername&&username.toLowerCase()===adminUsername.toLowerCase();
  return {isAdminUsername,lookupEmail:isAdminUsername?adminEmail:email};
}
