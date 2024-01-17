import { FindInPageOptions, Result } from 'electron';

type Event<Params extends object = {}> = {
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
} & Params;

export type WebContentsOnListener = (event: Event, result: Result) => void

export interface FindInPageParmas{
  text: string,
  options: FindInPageOptions
}

export interface StopFindInPageParmas{
  action: 'clearSelection' | 'keepSelection' | 'activateSelection'
}

export interface WebContentsOnParams{
  event: 'found-in-page'
}
