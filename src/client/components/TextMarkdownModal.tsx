import React from 'react';
import { ShareItem } from '@shared/types';
import { TextReaderView } from './TextReaderView';

interface TextMarkdownModalProps {
  item: ShareItem;
  isOpen: boolean;
  onClose: () => void;
  password?: string;
}

export const TextMarkdownModal: React.FC<TextMarkdownModalProps> = ({ item, isOpen, onClose, password }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-4xl lg:max-w-5xl shadow-2xl border border-slate-200/90 flex flex-col h-[85vh] overflow-hidden animate-scale-in">
        <TextReaderView item={item} password={password} onClose={onClose} />
      </div>
    </div>
  );
};
