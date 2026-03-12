'use client'

import { useAssistant } from '@/hooks/useAssistant'
import { useGoals } from '@/hooks/useGoals'
import { useTasks } from '@/hooks/useTasks'
import AssistantChat from '@/components/AssistantChat'
import ProposalReview from '@/components/ProposalReview'

export default function AssistantPage() {
  const { messages, proposal, setProposal, isStreaming, error, sendMessage } = useAssistant()
  const { createGoal } = useGoals()
  const { createTask } = useTasks()

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">AI Assistant</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-[500px] flex flex-col">
        <AssistantChat
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          onSend={sendMessage}
        />
      </div>

      {proposal && (
        <ProposalReview
          proposal={proposal}
          onProposalChange={setProposal}
          createGoal={createGoal}
          createTask={createTask}
        />
      )}
    </div>
  )
}
