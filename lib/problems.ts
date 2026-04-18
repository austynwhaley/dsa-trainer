import type { Problem } from "./types";

export const PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    difficulty: "easy",
    topic: "arrays",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

**Example 1:**
\`\`\`
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [3,2,4], target = 6
Output: [1,2]
\`\`\`

**Constraints:**
- 2 ≤ nums.length ≤ 10⁴
- -10⁹ ≤ nums[i] ≤ 10⁹
- Only one valid answer exists.`,
    starterCode: {
      javascript: `function twoSum(nums, target) {

}`,
      python: `def two_sum(nums: list[int], target: int) -> list[int]:
    pass`,
    },
    testCases: [
      { input: "[2,7,11,15], 9", expectedOutput: "[0,1]", description: "Basic case" },
      { input: "[3,2,4], 6", expectedOutput: "[1,2]", description: "Non-adjacent pair" },
      { input: "[3,3], 6", expectedOutput: "[0,1]", description: "Duplicate values" },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "easy",
    topic: "stack",
    description: `Given a string \`s\` containing just the characters \`'('\`, \`')'\`, \`'{'\`, \`'}'\`, \`'['\` and \`']'\`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket.

**Example 1:**
\`\`\`
Input: s = "()"
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "()[]{}"
Output: true
\`\`\`

**Example 3:**
\`\`\`
Input: s = "(]"
Output: false
\`\`\``,
    starterCode: {
      javascript: `function isValid(s) {

}`,
      python: `def is_valid(s: str) -> bool:
    pass`,
    },
    testCases: [
      { input: '"()"', expectedOutput: "true", description: "Simple pair" },
      { input: '"()[]{}"', expectedOutput: "true", description: "Multiple pairs" },
      { input: '"(]"', expectedOutput: "false", description: "Wrong closing" },
      { input: '"([)]"', expectedOutput: "false", description: "Wrong order" },
      { input: '"{[]}"', expectedOutput: "true", description: "Nested" },
    ],
  },
  {
    id: "binary-search",
    title: "Binary Search",
    difficulty: "easy",
    topic: "binary search",
    description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`. If \`target\` exists, then return its index. Otherwise, return \`-1\`.

You must write an algorithm with O(log n) runtime complexity.

**Example 1:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 9
Output: 4
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [-1,0,3,5,9,12], target = 2
Output: -1
\`\`\``,
    starterCode: {
      javascript: `function search(nums, target) {

}`,
      python: `def search(nums: list[int], target: int) -> int:
    pass`,
    },
    testCases: [
      { input: "[-1,0,3,5,9,12], 9", expectedOutput: "4", description: "Found in middle" },
      { input: "[-1,0,3,5,9,12], 2", expectedOutput: "-1", description: "Not found" },
      { input: "[5], 5", expectedOutput: "0", description: "Single element, found" },
      { input: "[5], 3", expectedOutput: "-1", description: "Single element, not found" },
    ],
  },
  {
    id: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "easy",
    topic: "linked list",
    description: `Given the head of a singly linked list, reverse the list, and return the reversed list.

**Example 1:**
\`\`\`
Input: head = [1,2,3,4,5]
Output: [5,4,3,2,1]
\`\`\`

**Example 2:**
\`\`\`
Input: head = [1,2]
Output: [2,1]
\`\`\`

**Note:** For this problem, a ListNode is provided as:
\`\`\`
class ListNode { constructor(val, next) { this.val = val; this.next = next ?? null; } }
\`\`\``,
    starterCode: {
      javascript: `function reverseList(head) {

}`,
      python: `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    pass`,
    },
    testCases: [
      { input: "[1,2,3,4,5]", expectedOutput: "[5,4,3,2,1]", description: "Five nodes" },
      { input: "[1,2]", expectedOutput: "[2,1]", description: "Two nodes" },
      { input: "[]", expectedOutput: "[]", description: "Empty list" },
    ],
  },
  {
    id: "maximum-subarray",
    title: "Maximum Subarray",
    difficulty: "medium",
    topic: "dynamic programming",
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

**Example 1:**
\`\`\`
Input: nums = [-2,1,-3,4,-1,2,1,-5,4]
Output: 6
Explanation: The subarray [4,-1,2,1] has the largest sum 6.
\`\`\`

**Example 2:**
\`\`\`
Input: nums = [1]
Output: 1
\`\`\`

**Example 3:**
\`\`\`
Input: nums = [5,4,-1,7,8]
Output: 23
\`\`\``,
    starterCode: {
      javascript: `function maxSubArray(nums) {

}`,
      python: `def max_sub_array(nums: list[int]) -> int:
    pass`,
    },
    testCases: [
      { input: "[-2,1,-3,4,-1,2,1,-5,4]", expectedOutput: "6", description: "Mixed negatives" },
      { input: "[1]", expectedOutput: "1", description: "Single element" },
      { input: "[5,4,-1,7,8]", expectedOutput: "23", description: "Mostly positive" },
      { input: "[-1,-2,-3]", expectedOutput: "-1", description: "All negative" },
    ],
  },
  {
    id: "number-of-islands",
    title: "Number of Islands",
    difficulty: "medium",
    topic: "graphs",
    description: `Given an \`m x n\` 2D binary grid where \`'1'\` is land and \`'0'\` is water, return the number of islands.

An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are surrounded by water.

**Example 1:**
\`\`\`
Input: grid = [
  ["1","1","1","1","0"],
  ["1","1","0","1","0"],
  ["1","1","0","0","0"],
  ["0","0","0","0","0"]
]
Output: 1
\`\`\`

**Example 2:**
\`\`\`
Input: grid = [
  ["1","1","0","0","0"],
  ["1","1","0","0","0"],
  ["0","0","1","0","0"],
  ["0","0","0","1","1"]
]
Output: 3
\`\`\``,
    starterCode: {
      javascript: `function numIslands(grid) {

}`,
      python: `def num_islands(grid: list[list[str]]) -> int:
    pass`,
    },
    testCases: [
      {
        input: '[["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]',
        expectedOutput: "1",
        description: "One big island",
      },
      {
        input: '[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]',
        expectedOutput: "3",
        description: "Three islands",
      },
    ],
  },
  {
    id: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "easy",
    topic: "dynamic programming",
    description: `You are climbing a staircase. It takes \`n\` steps to reach the top.

Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

**Example 1:**
\`\`\`
Input: n = 2
Output: 2
Explanation: (1+1) or (2)
\`\`\`

**Example 2:**
\`\`\`
Input: n = 3
Output: 3
Explanation: (1+1+1), (1+2), (2+1)
\`\`\``,
    starterCode: {
      javascript: `function climbStairs(n) {

}`,
      python: `def climb_stairs(n: int) -> int:
    pass`,
    },
    testCases: [
      { input: "2", expectedOutput: "2" },
      { input: "3", expectedOutput: "3" },
      { input: "10", expectedOutput: "89" },
      { input: "1", expectedOutput: "1" },
    ],
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "medium",
    topic: "arrays",
    description: `Given an array of \`intervals\` where \`intervals[i] = [starti, endi]\`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

**Example 1:**
\`\`\`
Input: intervals = [[1,3],[2,6],[8,10],[15,18]]
Output: [[1,6],[8,10],[15,18]]
\`\`\`

**Example 2:**
\`\`\`
Input: intervals = [[1,4],[4,5]]
Output: [[1,5]]
\`\`\``,
    starterCode: {
      javascript: `function merge(intervals) {

}`,
      python: `def merge(intervals: list[list[int]]) -> list[list[int]]:
    pass`,
    },
    testCases: [
      { input: "[[1,3],[2,6],[8,10],[15,18]]", expectedOutput: "[[1,6],[8,10],[15,18]]" },
      { input: "[[1,4],[4,5]]", expectedOutput: "[[1,5]]" },
      { input: "[[1,4],[0,4]]", expectedOutput: "[[0,4]]" },
    ],
  },
  {
    id: "lru-cache",
    title: "LRU Cache",
    difficulty: "medium",
    topic: "design",
    description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the \`LRUCache\` class:
- \`LRUCache(int capacity)\` Initialize the LRU cache with positive size \`capacity\`.
- \`int get(int key)\` Return the value of the key if it exists, otherwise return \`-1\`.
- \`void put(int key, int value)\` Update the value if key exists. Otherwise, add the key-value pair. If the number of keys exceeds capacity, evict the least recently used key.

Both \`get\` and \`put\` must run in O(1) average time complexity.

**Example:**
\`\`\`
Input: ["LRUCache","put","put","get","put","get","put","get","get","get"]
       [[2],[1,1],[2,2],[1],[3,3],[2],[4,4],[1],[3],[4]]
Output: [null,null,null,1,null,-1,null,-1,3,4]
\`\`\``,
    starterCode: {
      javascript: `class LRUCache {
  constructor(capacity) {

  }

  get(key) {

  }

  put(key, value) {

  }
}`,
      python: `class LRUCache:
    def __init__(self, capacity: int):
        pass

    def get(self, key: int) -> int:
        pass

    def put(self, key: int, value: int) -> None:
        pass`,
    },
    testCases: [
      {
        input: 'capacity=2, ops=[["put",1,1],["put",2,2],["get",1],["put",3,3],["get",2],["put",4,4],["get",1],["get",3],["get",4]]',
        expectedOutput: "[null,null,1,null,-1,null,-1,3,4]",
        description: "Standard LRU operations",
      },
    ],
  },
  {
    id: "word-break",
    title: "Word Break",
    difficulty: "medium",
    topic: "dynamic programming",
    description: `Given a string \`s\` and a dictionary of strings \`wordDict\`, return \`true\` if \`s\` can be segmented into a space-separated sequence of one or more dictionary words.

Note that the same word in the dictionary may be reused multiple times.

**Example 1:**
\`\`\`
Input: s = "leetcode", wordDict = ["leet","code"]
Output: true
\`\`\`

**Example 2:**
\`\`\`
Input: s = "applepenapple", wordDict = ["apple","pen"]
Output: true
\`\`\`

**Example 3:**
\`\`\`
Input: s = "catsandog", wordDict = ["cats","dog","sand","and","cat"]
Output: false
\`\`\``,
    starterCode: {
      javascript: `function wordBreak(s, wordDict) {

}`,
      python: `def word_break(s: str, word_dict: list[str]) -> bool:
    pass`,
    },
    testCases: [
      { input: '"leetcode", ["leet","code"]', expectedOutput: "true" },
      { input: '"applepenapple", ["apple","pen"]', expectedOutput: "true" },
      { input: '"catsandog", ["cats","dog","sand","and","cat"]', expectedOutput: "false" },
    ],
  },
];

export function getProblemById(id: string): Problem | undefined {
  return PROBLEMS.find((p) => p.id === id);
}
