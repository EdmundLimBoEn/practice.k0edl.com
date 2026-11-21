import audioWaveformIcon from 'lucide-static/icons/audio-waveform.svg?raw'
import radioIcon from 'lucide-static/icons/radio.svg?raw'
import chartNoAxesColumnIncreasingIcon from 'lucide-static/icons/chart-no-axes-column-increasing.svg?raw'
import antennaIcon from 'lucide-static/icons/antenna.svg?raw'
import headphonesIcon from 'lucide-static/icons/headphones.svg?raw'
import clock3Icon from 'lucide-static/icons/clock-3.svg?raw'
import timerIcon from 'lucide-static/icons/timer.svg?raw'
import wrenchIcon from 'lucide-static/icons/wrench.svg?raw'
import circleHelpIcon from 'lucide-static/icons/circle-help.svg?raw'
import panelLeftIcon from 'lucide-static/icons/panel-left.svg?raw'
import chevronRightIcon from 'lucide-static/icons/chevron-right.svg?raw'
import crosshairIcon from 'lucide-static/icons/crosshair.svg?raw'
import slidersHorizontalIcon from 'lucide-static/icons/sliders-horizontal.svg?raw'
import activityIcon from 'lucide-static/icons/activity.svg?raw'
import volume2Icon from 'lucide-static/icons/volume-2.svg?raw'
import mousePointer2Icon from 'lucide-static/icons/mouse-pointer-2.svg?raw'
import moveHorizontalIcon from 'lucide-static/icons/move-horizontal.svg?raw'
import zoomInIcon from 'lucide-static/icons/zoom-in.svg?raw'
import zoomOutIcon from 'lucide-static/icons/zoom-out.svg?raw'
import bookOpenIcon from 'lucide-static/icons/book-open.svg?raw'
import listFilterIcon from 'lucide-static/icons/list-filter.svg?raw'
import locateFixedIcon from 'lucide-static/icons/locate-fixed.svg?raw'
import radarIcon from 'lucide-static/icons/radar.svg?raw'
import radioTowerIcon from 'lucide-static/icons/radio-tower.svg?raw'
const icons: Record<string, string> = {
  'audio-waveform': audioWaveformIcon,
  radio: radioIcon,
  'chart-no-axes-column-increasing': chartNoAxesColumnIncreasingIcon,
  antenna: antennaIcon,
  headphones: headphonesIcon,
  'clock-3': clock3Icon,
  timer: timerIcon,
  wrench: wrenchIcon,
  'circle-help': circleHelpIcon,
  'panel-left': panelLeftIcon,
  'chevron-right': chevronRightIcon,
  crosshair: crosshairIcon,
  'sliders-horizontal': slidersHorizontalIcon,
  activity: activityIcon,
  'volume-2': volume2Icon,
  'mouse-pointer-2': mousePointer2Icon,
  'move-horizontal': moveHorizontalIcon,
  'zoom-in': zoomInIcon,
  'zoom-out': zoomOutIcon,
  'book-open': bookOpenIcon,
  'list-filter': listFilterIcon,
  'locate-fixed': locateFixedIcon,
  radar: radarIcon,
  'radio-tower': radioTowerIcon,
}
export const icon = (name: string) =>
  '<i aria-hidden="true">' + icons[name] + '</i>'
