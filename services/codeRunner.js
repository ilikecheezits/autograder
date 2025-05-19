const axios = require('axios');
const config = require('../config');
const testCaseService = require('./testCaseService');
const cfAPI = require('./cfAPI');

class CodeRunnerService {
    constructor() {
        this.baseUrl = 'http://localhost:8080';
        this.timeout = 30000; // 30 seconds timeout
    }

    formatErrorMessage(error) {
        if (error.response?.data?.error) {
            return error.response.data.error;
        }
        if (error.response?.data?.output) {
            return error.response.data.output;
        }
        if (typeof error === 'string') {
            return error;
        }
        if (error.message) {
            return error.message;
        }
        return 'Unknown error occurred';
    }

    normalizeOutput(output) {
        if (!output) return '';
        
        // Convert to string if not already
        output = String(output);
        
        // Normalize line endings to \n
        output = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Remove trailing whitespace from each line
        output = output.split('\n').map(line => line.trimRight()).join('\n');
        
        // Remove leading/trailing empty lines
        output = output.trim();
        
        // Collapse multiple empty lines into one
        output = output.replace(/\n\s*\n/g, '\n');
        
        return output;
    }

    normalizeInput(input) {
        if (!input) return '';
        
        // Convert to string if not already
        input = String(input);
        
        // Normalize line endings to \n
        input = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        // Ensure input ends with a newline if it doesn't already
        if (!input.endsWith('\n')) {
            input += '\n';
        }
        
        return input;
    }

    compareOutputs(actual, expected) {
        const normalizedActual = this.normalizeOutput(actual);
        const normalizedExpected = this.normalizeOutput(expected);

        if (normalizedActual === normalizedExpected) {
            return { match: true };
        }

        // Split into lines for detailed comparison
        const actualLines = normalizedActual.split('\n');
        const expectedLines = normalizedExpected.split('\n');

        // Find first difference
        let firstDiffLine = 0;
        const minLines = Math.min(actualLines.length, expectedLines.length);
        
        for (let i = 0; i < minLines; i++) {
            if (actualLines[i] !== expectedLines[i]) {
                firstDiffLine = i;
                break;
            }
        }

        return {
            match: false,
            details: {
                firstDiffLine: firstDiffLine + 1,
                expectedLines: expectedLines.length,
                actualLines: actualLines.length,
                expectedLine: expectedLines[firstDiffLine],
                actualLine: actualLines[firstDiffLine],
                lengthMismatch: actualLines.length !== expectedLines.length
            }
        };
    }

    async runCode(submission) {
        try {
            // Get test cases for the problem
            let testCases;
            
            // Try to get CF testcases if it's a CF problem
            if (submission.problemId.startsWith('CF')) {
                try {
                    const [_, contestId, problemIndex] = submission.problemId.match(/CF(\d+)([A-Z])/);
                    console.log(`Fetching test cases for CF${contestId}${problemIndex}`);
                    const cfProblem = await cfAPI.getProblemTestcases(contestId, problemIndex);
                    testCases = cfProblem.samples;
                    
                    // Update submission limits from CF problem
                    submission.timeLimit = cfProblem.timeLimit;
                    submission.memoryLimit = cfProblem.memoryLimit;
                } catch (error) {
                    console.error('Failed to get CF testcases:', error);
                    // Fall back to local testcases
                    testCases = await testCaseService.getTestCases(submission.problemId);
                }
            } else {
                testCases = await testCaseService.getTestCases(submission.problemId);
            }
            
            if (!testCases || testCases.length === 0) {
                return {
                    success: false,
                    verdict: 'No Test Cases',
                    output: 'No test cases available for this problem'
                };
            }

            console.log(`Running against ${testCases.length} test cases`);

            // Track overall execution stats
            let totalTime = 0;
            let maxMemory = 0;
            let failedTestCase = null;

            // Run against each test case
            for (let i = 0; i < testCases.length; i++) {
                const testCase = testCases[i];
                
                try {
                    console.log(`Running test case ${i + 1}/${testCases.length}`);
                    
                    // Normalize input before sending to coderunner
                    const normalizedInput = this.normalizeInput(testCase.input);
                    
                    // Send to coderunner server
                    const response = await axios.post(`${this.baseUrl}/run`, {
                        code: submission.code,
                        lang: submission.language,
                        input: normalizedInput,
                        problemid: submission.problemId,
                        tl: submission.timeLimit || config.defaultLimits.timeMs,
                        ml: submission.memoryLimit || config.defaultLimits.memoryMb
                    }, {
                        timeout: this.timeout
                    });

                    const result = response.data;

                    // Check for compilation/runtime errors first
                    if (result.verdict !== 'Accepted') {
                        return {
                            success: false,
                            verdict: result.verdict,
                            output: `Failed on test case ${i + 1}:\n` +
                                   `Input:\n${testCase.input}\n\n` +
                                   `Error:\n${this.formatErrorMessage(result)}`,
                            time: result.time || 0,
                            memory: result.memory || 0
                        };
                    }

                    // Update statistics
                    totalTime += result.time || 0;
                    maxMemory = Math.max(maxMemory, result.memory || 0);

                    // Check if output matches expected
                    const comparison = this.compareOutputs(result.output, testCase.output);

                    if (!comparison.match) {
                        failedTestCase = {
                            number: i + 1,
                            verdict: 'Wrong Answer',
                            input: testCase.input,
                            expected: testCase.output,
                            actual: result.output,
                            details: comparison.details
                        };
                        break;
                    }

                    // Check time limit
                    if (result.time > submission.timeLimit) {
                        failedTestCase = {
                            number: i + 1,
                            verdict: 'Time Limit Exceeded',
                            input: testCase.input,
                            time: result.time,
                            limit: submission.timeLimit
                        };
                        break;
                    }

                    // Check memory limit
                    if (result.memory > submission.memoryLimit) {
                        failedTestCase = {
                            number: i + 1,
                            verdict: 'Memory Limit Exceeded',
                            input: testCase.input,
                            memory: result.memory,
                            limit: submission.memoryLimit
                        };
                        break;
                    }

                } catch (error) {
                    console.error(`Error on test case ${i + 1}:`, error);
                    return {
                        success: false,
                        verdict: 'Runtime Error',
                        output: `Failed on test case ${i + 1}\n` +
                               `Input:\n${testCase.input}\n\n` +
                               `Error:\n${this.formatErrorMessage(error)}`,
                        time: totalTime,
                        memory: maxMemory
                    };
                }
            }

            if (failedTestCase) {
                let output = `Failed on test case ${failedTestCase.number}:\n` +
                           `Input:\n${failedTestCase.input}\n\n`;

                if (failedTestCase.verdict === 'Wrong Answer') {
                    output += `Expected output:\n${failedTestCase.expected}\n\n` +
                             `Your output:\n${failedTestCase.actual}\n\n` +
                             `Difference details:\n`;
                             
                    if (failedTestCase.details.lengthMismatch) {
                        output += `- Number of lines mismatch: expected ${failedTestCase.details.expectedLines} lines but got ${failedTestCase.details.actualLines} lines\n`;
                    }
                    
                    output += `- First difference at line ${failedTestCase.details.firstDiffLine}:\n` +
                             `  Expected: "${failedTestCase.details.expectedLine}"\n` +
                             `  Got: "${failedTestCase.details.actualLine}"`;
                             
                } else if (failedTestCase.verdict === 'Time Limit Exceeded') {
                    output += `Time limit: ${failedTestCase.limit}ms\n` +
                             `Your time: ${failedTestCase.time}ms`;
                } else if (failedTestCase.verdict === 'Memory Limit Exceeded') {
                    output += `Memory limit: ${failedTestCase.limit} MB\n` +
                             `Your memory: ${failedTestCase.memory} MB`;
                }

                return {
                    success: false,
                    verdict: failedTestCase.verdict,
                    output: output,
                    time: totalTime,
                    memory: maxMemory
                };
            }

            return {
                success: true,
                verdict: 'Accepted',
                output: `All ${testCases.length} test cases passed!`,
                time: totalTime,
                memory: maxMemory
            };

        } catch (error) {
            console.error('Error in runCode:', error);
            return {
                success: false,
                verdict: 'System Error',
                output: this.formatErrorMessage(error),
                time: 0,
                memory: 0
            };
        }
    }
}

module.exports = new CodeRunnerService(); 