export function resolveCredentialLookup(username:string,email:string,adminUsername:string|undefined,adminEmail:string|undefined){
  const isAdminUsername=!!username&&!!adminUsername&&username.toLowerCase()===adminUsername.toLowerCase();
  return {isAdminUsername,lookupEmail:isAdminUsername?adminEmail:email};
}
