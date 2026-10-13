import { DropZone } from './DropZone.tsx'
import { HistoryControls } from './HistoryControls.tsx'
import { HistoryList } from './HistoryList.tsx'
import { HomeFooter } from './HomeFooter.tsx'
import { Notices } from './Notices.tsx'
import { StorageBanner } from './StorageBanner.tsx'

export function HomeScreen() {
  return (
    <div className="space-y-5">
      <StorageBanner />
      <DropZone />
      <Notices />
      <HistoryControls />
      <HistoryList />
      <HomeFooter />
    </div>
  )
}
