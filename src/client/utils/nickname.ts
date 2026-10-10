import { useState, useEffect, useCallback } from 'react';

export interface SpongeBobCharacter {
  name: string;
  enName: string;
  emoji: string;
  color: string;
}

export const SPONGEBOB_CHARACTERS: SpongeBobCharacter[] = [
  { name: '海绵宝宝', enName: 'SpongeBob', emoji: '🧽', color: 'from-amber-400 to-yellow-500' },
  { name: '派大星', enName: 'Patrick Star', emoji: '⭐️', color: 'from-pink-400 to-rose-400' },
  { name: '章鱼哥', enName: 'Squidward', emoji: '🐙', color: 'from-teal-400 to-cyan-500' },
  { name: '蟹老板', enName: 'Mr. Krabs', emoji: '🦀', color: 'from-red-500 to-rose-600' },
  { name: '痞老板', enName: 'Plankton', emoji: '🦠', color: 'from-emerald-500 to-teal-600' },
  { name: '珊迪', enName: 'Sandy Cheeks', emoji: '🐿️', color: 'from-amber-500 to-orange-500' },
  { name: '小蜗', enName: 'Gary', emoji: '🐌', color: 'from-sky-400 to-indigo-400' },
  { name: '泡芙阿姨', enName: 'Mrs. Puff', emoji: '🐡', color: 'from-yellow-300 to-amber-400' },
  { name: '珍珠', enName: 'Pearl Krabs', emoji: '🐳', color: 'from-blue-400 to-sky-500' },
  { name: '凯伦', enName: 'Karen', emoji: '💻', color: 'from-slate-400 to-blue-500' },
  { name: '飞天魔鬼', enName: 'Flying Dutchman', emoji: '👻', color: 'from-emerald-600 to-green-700' },
  { name: '虾霸拉里', enName: 'Larry Lobster', emoji: '🦞', color: 'from-red-600 to-orange-600' },
  { name: '美人鱼战士', enName: 'Mermaid Man', emoji: '🦸‍♂️', color: 'from-purple-500 to-indigo-600' },
  { name: '企鹅男孩', enName: 'Barnacle Boy', emoji: '🦸', color: 'from-cyan-500 to-blue-600' },
  { name: '鹦鹉波特', enName: 'Potty Parrot', emoji: '🦜', color: 'from-lime-500 to-emerald-600' },
  { name: '曼雷', enName: 'Man Ray', emoji: '🦹', color: 'from-indigo-600 to-purple-700' },
  { name: '泡泡男孩', enName: 'Bubble Buddy', emoji: '🧼', color: 'from-sky-300 to-blue-400' },
  { name: '弗雷德', enName: 'Fred (My Leg)', emoji: '🦵', color: 'from-amber-600 to-stone-500' },
];

export const NICKNAME_STORAGE_KEY = 'lightdrop_user_nickname';
const NICKNAME_CHANGE_EVENT = 'lightdrop:nickname-changed';

/**
 * 随机获取一个海绵宝宝角色
 */
export function getRandomSpongeBobCharacter(): SpongeBobCharacter {
  const index = Math.floor(Math.random() * SPONGEBOB_CHARACTERS.length);
  return SPONGEBOB_CHARACTERS[index];
}

/**
 * 获取当前用户昵称 (优先从 localStorage 获取，无缓存则随机抽取海绵宝宝角色并持久化)
 */
export function getUserNickname(): string {
  if (typeof window === 'undefined') {
    return '海绵宝宝';
  }
  try {
    const cached = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (cached && cached.trim()) {
      return cached.trim();
    }
    // 随机分配海绵宝宝角色
    const randomChar = getRandomSpongeBobCharacter();
    localStorage.setItem(NICKNAME_STORAGE_KEY, randomChar.name);
    return randomChar.name;
  } catch {
    return '海绵宝宝';
  }
}

/**
 * 设置并缓存用户昵称
 */
export function setUserNickname(nickname: string): string {
  const trimmed = nickname.trim() || getRandomSpongeBobCharacter().name;
  try {
    localStorage.setItem(NICKNAME_STORAGE_KEY, trimmed);
    window.dispatchEvent(new CustomEvent(NICKNAME_CHANGE_EVENT, { detail: trimmed }));
  } catch (err) {
    console.warn('Failed to save nickname to localStorage:', err);
  }
  return trimmed;
}

/**
 * 根据昵称匹配对应的角色信息（表情和主题色）
 */
export function getCharacterInfo(nickname?: string): { emoji: string; color: string } {
  if (!nickname) {
    return { emoji: '🧽', color: 'from-amber-400 to-yellow-500' };
  }
  const match = SPONGEBOB_CHARACTERS.find(
    (c) => c.name === nickname || c.enName.toLowerCase() === nickname.toLowerCase()
  );
  if (match) {
    return { emoji: match.emoji, color: match.color };
  }
  // 未匹配到内置角色时提供通用友好图标
  return { emoji: '✨', color: 'from-blue-500 to-indigo-500' };
}

/**
 * React Hook: 管理与响应昵称变化
 */
export function useNickname() {
  const [nickname, setNicknameState] = useState<string>(() => getUserNickname());

  useEffect(() => {
    const handleUpdate = () => {
      setNicknameState(getUserNickname());
    };

    window.addEventListener(NICKNAME_CHANGE_EVENT, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(NICKNAME_CHANGE_EVENT, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const updateNickname = useCallback((newName: string) => {
    const updated = setUserNickname(newName);
    setNicknameState(updated);
    return updated;
  }, []);

  const randomizeNickname = useCallback(() => {
    let nextChar = getRandomSpongeBobCharacter();
    // 尽量不随机到当前同一个角色
    if (nextChar.name === nickname && SPONGEBOB_CHARACTERS.length > 1) {
      const candidates = SPONGEBOB_CHARACTERS.filter((c) => c.name !== nickname);
      nextChar = candidates[Math.floor(Math.random() * candidates.length)];
    }
    return updateNickname(nextChar.name);
  }, [nickname, updateNickname]);

  const charInfo = getCharacterInfo(nickname);

  return {
    nickname,
    charInfo,
    updateNickname,
    randomizeNickname,
    allCharacters: SPONGEBOB_CHARACTERS,
  };
}
