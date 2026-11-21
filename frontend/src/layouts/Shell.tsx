import { useAppearance } from '../state/Appearance'
import ClassicLayout from './ClassicLayout'
import RiftLayout from './RiftLayout'

/** Picks the layout for the interface on screen (Classic while previewing). Both render the same routes. */
export default function Shell() {
  const { ui } = useAppearance()
  return ui === 'classic' ? <ClassicLayout /> : <RiftLayout />
}
