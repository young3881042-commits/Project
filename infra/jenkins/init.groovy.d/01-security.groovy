import hudson.security.FullControlOnceLoggedInAuthorizationStrategy
import hudson.security.HudsonPrivateSecurityRealm
import jenkins.model.Jenkins

def instance = Jenkins.get()
def adminId = System.getenv('JENKINS_ADMIN_ID') ?: 'admin'
def adminPassword = System.getenv('JENKINS_ADMIN_PASSWORD')

if (!adminPassword?.trim()) {
    throw new IllegalStateException('JENKINS_ADMIN_PASSWORD must be set')
}

def realm = new HudsonPrivateSecurityRealm(false)
if (realm.getUser(adminId) == null) {
    realm.createAccount(adminId, adminPassword)
}

def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)

instance.setSecurityRealm(realm)
instance.setAuthorizationStrategy(strategy)
instance.setNumExecutors(1)
instance.setScmCheckoutRetryCount(2)
instance.setQuietPeriod(5)
instance.save()
