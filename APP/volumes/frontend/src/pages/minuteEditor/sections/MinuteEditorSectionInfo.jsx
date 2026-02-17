/**
 * pages/minuteEditor/sections/MinuteEditorSectionInfo.jsx
 * Tab "Información General": grid 2×2 con 4 cards.
 */

import React from 'react';
import MinuteEditorCardMeeting               from './cards/MinuteEditorCardMeeting';
import MinuteEditorCardTimes                 from './cards/MinuteEditorCardTimes';
import MinuteEditorCardParticipationSummary  from './cards/MinuteEditorCardParticipationSummary';
import MinuteEditorCardAdditionalInfo        from './cards/MinuteEditorCardAdditionalInfo';

const MinuteEditorSectionInfo = () => (
  <div className="grid grid-cols-12 gap-6">
    <div className="col-span-12 md:col-span-6">
      <MinuteEditorCardMeeting />
    </div>
    <div className="col-span-12 md:col-span-6">
      <MinuteEditorCardTimes />
    </div>
    <div className="col-span-12 md:col-span-6">
      <MinuteEditorCardParticipationSummary />
    </div>
    <div className="col-span-12 md:col-span-6">
      <MinuteEditorCardAdditionalInfo />
    </div>
  </div>
);

export default MinuteEditorSectionInfo;