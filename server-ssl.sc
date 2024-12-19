portHttps          :: 443
portHttp           :: 80

certificate        :: "certificate.pem"
private-key        :: "private-key.pem"

websiteRoot        :: "wwwroot"
entryPage          :: "index.html"
errorRoot          :: "error"

noCheckNodeVersion :: false

useLetsEncrypt     :: false
domains            :: ["ssl.boats","www.ssl.boats"]
generateCertAnyway :: false
useStaging         :: false

useDnsProvider     :: false
providerName       :: "Cloud Flare"
providerToken      :: "apiTokenWithDnsEditPermission"
providerZone       :: ""