import { Formik, Form, ErrorMessage } from 'formik';
import React, { useRef, useEffect } from 'react';
import type { InitialPlaylistForm } from '../types/initial-playlist-form';
import { CREATE_NEW_PLAYLIST_IDENTIFIER } from '../constants';
import { TrashIcon } from './TrashIcon';
import type { RootlistPlaylist, RootListItems, Folder } from '../utils';

interface Props {
   playlists: RootlistPlaylist[];
   playlistItems: RootListItems[];
   onSubmit: SubmitEventHandler;
   onDelete?: DeleteEventHandler;
   initialForm?: InitialPlaylistForm;
   isNew?: boolean;
}

export type SubmitEventHandler = (form: InitialPlaylistForm) => void;
export type DeleteEventHandler = () => void;

const defaultForm: InitialPlaylistForm = {
   target: CREATE_NEW_PLAYLIST_IDENTIFIER,
   sources: []
};

function getFolderPlaylistIds(folder: Folder): string[] {
   return folder.items.flatMap(item => {
      if (item.type === 'playlist') return [item.id];
      if (item.type === 'folder') return getFolderPlaylistIds(item);
      return [];
   });
}

function IndeterminateCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
   const ref = useRef<HTMLInputElement>(null);
   useEffect(() => {
      if (ref.current) ref.current.indeterminate = indeterminate;
   }, [indeterminate]);
   return <input type="checkbox" ref={ref} checked={checked} onChange={onChange} />;
}

interface FolderItemProps {
   folder: Folder;
   sources: string[];
   onTogglePlaylist: (id: string) => void;
   onToggleFolder: (folder: Folder) => void;
}

function FolderItem({ folder, sources, onTogglePlaylist, onToggleFolder }: FolderItemProps) {
   const folderIds = getFolderPlaylistIds(folder);
   const selectedCount = folderIds.filter(id => sources.includes(id)).length;
   const allSelected = folderIds.length > 0 && selectedCount === folderIds.length;
   const someSelected = selectedCount > 0 && !allSelected;

   return (
      <div className="source-folder-group">
         <label className="source-folder-header">
            <IndeterminateCheckbox
               checked={allSelected}
               indeterminate={someSelected}
               onChange={() => onToggleFolder(folder)}
            />
            <span className="source-folder-name">{folder.name}</span>
         </label>
         <div className="source-folder-items">
            {folder.items.map((item) => {
               if (item.type === 'playlist') {
                  return (
                     <label key={item.id} className="source-playlist-item">
                        <input type="checkbox" checked={sources.includes(item.id)} onChange={() => onTogglePlaylist(item.id)} />
                        <span>{item.name}</span>
                     </label>
                  );
               }
               if (item.type === 'folder') {
                  return (
                     <FolderItem
                        key={item.uri}
                        folder={item}
                        sources={sources}
                        onTogglePlaylist={onTogglePlaylist}
                        onToggleFolder={onToggleFolder}
                     />
                  );
               }
               return null;
            })}
         </div>
      </div>
   );
}

export function PlaylistForm({ playlists, playlistItems, onSubmit, onDelete, initialForm = defaultForm, isNew = true }: Props) {
   const validationFn = (form: InitialPlaylistForm) => {
      const errors: Record<string, unknown> = {};
      if (form.sources.length === 0) errors.sources = 'Select at least one source playlist';
      if (!form.target) errors.target = 'Select a target playlist';
      return errors;
   };

   const ErrorMsg = ({ name }: { name: string }) => (
      <ErrorMessage name={name}>{msg => <div className="error-msg">{msg}</div>}</ErrorMessage>
   );

   return (
      <Formik initialValues={initialForm} onSubmit={onSubmit} validate={validationFn}>
         {({ values, setFieldValue, isSubmitting }) => {
            const togglePlaylist = (id: string) => {
               if (values.sources.includes(id)) {
                  setFieldValue('sources', values.sources.filter(s => s !== id));
               } else {
                  setFieldValue('sources', [...values.sources, id]);
               }
            };

            const toggleFolder = (folder: Folder) => {
               const folderIds = getFolderPlaylistIds(folder);
               const allSelected = folderIds.every(id => values.sources.includes(id));
               if (allSelected) {
                  setFieldValue('sources', values.sources.filter(id => !folderIds.includes(id)));
               } else {
                  const toAdd = folderIds.filter(id => !values.sources.includes(id));
                  setFieldValue('sources', [...values.sources, ...toAdd]);
               }
            };

            return (
               <Form id="create-combined-playlist-form">
                  <fieldset disabled={isSubmitting}>
                     <h3>Source playlists</h3>
                     <div className="source-playlist-list">
                        {playlistItems.map((item) => {
                           if (item.type === 'playlist') {
                              return (
                                 <label key={item.id} className="source-playlist-item">
                                    <input type="checkbox" checked={values.sources.includes(item.id)} onChange={() => togglePlaylist(item.id)} />
                                    <span>{item.name}</span>
                                 </label>
                              );
                           }
                           if (item.type === 'folder') {
                              return (
                                 <FolderItem
                                    key={item.uri}
                                    folder={item}
                                    sources={values.sources}
                                    onTogglePlaylist={togglePlaylist}
                                    onToggleFolder={toggleFolder}
                                 />
                              );
                           }
                           return null;
                        })}
                     </div>
                     <ErrorMsg name="sources" />

                     <h3>Target playlist</h3>
                     <select
                        name="target"
                        id="target-select-field"
                        className="main-dropDown-dropDown"
                        value={values.target}
                        onChange={(e) => setFieldValue('target', e.target.value)}
                     >
                        <option value={CREATE_NEW_PLAYLIST_IDENTIFIER}>Create new playlist</option>
                        {playlists.map(({ id, name }) => (
                           <option key={id} value={id}>{name}</option>
                        ))}
                     </select>
                     <ErrorMsg name="target" />

                     <div id="form-actions-container">
                        <button type="submit" className="main-buttons-button main-button-outlined">
                           {isSubmitting ? 'Loading..' : (isNew ? 'Submit' : 'Save')}
                        </button>
                        {!isNew && (
                           <button
                              type="button"
                              className="main-buttons-button main-button-outlined btn__add-playlist"
                              onClick={() => onDelete?.()}
                           >
                              <TrashIcon />
                           </button>
                        )}
                     </div>
                  </fieldset>
               </Form>
            );
         }}
      </Formik>
   );
}
