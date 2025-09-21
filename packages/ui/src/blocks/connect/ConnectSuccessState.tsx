import { ConnectCardItem } from "./ConnectCards"

interface ConnectSuccessStateProps {
  cardsTitle?: string
  onConnectFacebook?: () => void
  onConnectGoogle?: () => void
  isFacebookConnected?: boolean
  isGoogleConnected?: boolean
}

export function ConnectSuccessState({
  cardsTitle = "Connect Your Data Sources",
  onConnectFacebook,
  onConnectGoogle,
  isFacebookConnected = false,
  isGoogleConnected = false,
}: ConnectSuccessStateProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-center">{cardsTitle}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <ConnectCardItem
          icon="facebookAds"
          name="Facebook Ads"
          onConnect={onConnectFacebook}
          isConnected={isFacebookConnected}
        />
        <ConnectCardItem
          icon="googleAds"
          name="Google Ads"
          onConnect={onConnectGoogle}
          isConnected={isGoogleConnected}
        />
      </div>
    </div>
  )
}
