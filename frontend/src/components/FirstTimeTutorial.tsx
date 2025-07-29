import React, { useState } from 'react'
import { X, ChevronLeft, ChevronRight, Target, BarChart3, Upload, CheckCircle } from 'lucide-react'

interface TutorialStep {
    title: string
    description: string
    icon: React.ComponentType<any>
    action?: string
}

interface FirstTimeTutorialProps {
    onClose: () => void
    onGetStarted: () => void
}

export default function FirstTimeTutorial({ onClose, onGetStarted }: FirstTimeTutorialProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const steps: TutorialStep[] = [
        {
            title: "Welcome to OFE!",
            description: "OFE helps you track and prove your organization's impact. Let's get you set up in 3 simple steps!",
            icon: Target,
            action: "Ready to get started?"
        },
        {
            title: "Step 1: Create an Initiative",
            description: "Think of an initiative as one of your main projects. For example: 'Youth Training 2025' or 'Clean Water Project'. You can create multiple initiatives later.",
            icon: Target,
            action: "We'll create your first initiative next"
        },
        {
            title: "Step 2: Add KPIs",
            description: "KPIs are what you want to measure. Keep it simple: 'People Trained', 'Wells Built', or 'Meals Provided'. You can always add more later.",
            icon: BarChart3,
            action: "Think of 2-3 things you want to track"
        },
        {
            title: "Step 3: Track & Prove",
            description: "Add data regularly (weekly or monthly) and upload photos or documents as proof. The app will show you how well-proven your impact is with color indicators.",
            icon: Upload,
            action: "Green = fully proven, Yellow = some proof, Red = needs evidence"
        },
        {
            title: "You're ready!",
            description: "That's it! The app will guide you with helpful hints about what to do next. You can always click the help button to see this tutorial again.",
            icon: CheckCircle,
            action: "Let's create your first initiative!"
        }
    ]

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            onGetStarted()
        }
    }

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }

    const currentStepData = steps[currentStep]
    const IconComponent = currentStepData.icon

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center">
                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <IconComponent className="w-8 h-8 text-primary-600" />
                    </div>

                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        {currentStepData.title}
                    </h2>

                    <p className="text-gray-600 mb-6 leading-relaxed">
                        {currentStepData.description}
                    </p>

                    {currentStepData.action && (
                        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 mb-6">
                            <p className="text-sm text-primary-700 font-medium">
                                💡 {currentStepData.action}
                            </p>
                        </div>
                    )}

                    {/* Step Indicators */}
                    <div className="flex items-center justify-center space-x-2 mb-6">
                        {steps.map((_, index) => (
                            <div
                                key={index}
                                className={`w-2 h-2 rounded-full ${index === currentStep
                                    ? 'bg-primary-600'
                                    : index < currentStep
                                        ? 'bg-primary-300'
                                        : 'bg-gray-200'
                                    }`}
                            />
                        ))}
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${currentStep === 0
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                }`}
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Previous</span>
                        </button>

                        <span className="text-sm text-gray-500">
                            {currentStep + 1} of {steps.length}
                        </span>

                        <button
                            onClick={handleNext}
                            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                        >
                            <span>
                                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Skip Option */}
                    <button
                        onClick={onClose}
                        className="text-sm text-gray-500 hover:text-gray-700 mt-4 underline"
                    >
                        Skip tutorial for now
                    </button>
                </div>
            </div>
        </div>
    )
} 