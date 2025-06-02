# Fuzzy Search/Replace with Line Skipping - Demo

This document demonstrates the new fuzzy search/replace functionality that supports line skipping in SEARCH/REPLACE blocks.

## Problem Solved

Previously, SEARCH/REPLACE blocks required exact matches, including all lines between the first and last parameter you wanted to change. This was inflexible and verbose.

**Before (Required exact match):**

```
<<<<<<< SEARCH
[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=true
Twocolor=Std
Redlow=0
Greenlow=0
Bluelow=0
=======
[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=true
Twocolor=Std
Redlow=20
Greenlow=0
Bluelow=0
>>>>>>> REPLACE
```

**Now (Can skip unchanged lines):**

```
<<<<<<< SEARCH
[ColorToning]
Lumamode=true
Twocolor=Std
Redlow=0
=======
[ColorToning]
Lumamode=true
Twocolor=Std
Redlow=20
>>>>>>> REPLACE
```

## How It Works

The new fuzzy matching algorithm:

1. **Identifies the section** by finding the section header (e.g., `[ColorToning]`)
2. **Extracts parameters** from both search and replace patterns
3. **Maps parameter names** to their new values
4. **Applies changes** only to the specified parameters within that section
5. **Preserves everything else** including:
   - Original indentation
   - Parameter order
   - Unchanged parameters
   - Other sections

## Examples

### Example 1: Simple Parameter Change

**Original PP3 content:**

```
[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=true
Twocolor=Std
Redlow=0
Greenlow=0
Bluelow=0
Satlow=0
Balance=0
```

**AI generates:**

```
<<<<<<< SEARCH
[ColorToning]
Redlow=0
=======
[ColorToning]
Redlow=25
>>>>>>> REPLACE
```

**Result:**

```
[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=true
Twocolor=Std
Redlow=25
Greenlow=0
Bluelow=0
Satlow=0
Balance=0
```

### Example 2: Multiple Parameter Changes

**AI generates:**

```
<<<<<<< SEARCH
[ColorToning]
Lumamode=true
Redlow=0
Greenlow=0
Balance=0
=======
[ColorToning]
Lumamode=false
Redlow=15
Greenlow=10
Balance=5
>>>>>>> REPLACE
```

**Result:**

```
[ColorToning]
Enabled=false
Method=LabRegions
Lumamode=false
Twocolor=Std
Redlow=15
Greenlow=10
Bluelow=0
Satlow=0
Balance=5
```

### Example 3: Preserving Indentation

**Original with indentation:**

```
[ColorToning]
  Enabled=false
  Method=LabRegions
  Lumamode=true
  Redlow=0
```

**AI generates:**

```
<<<<<<< SEARCH
[ColorToning]
Lumamode=true
Redlow=0
=======
[ColorToning]
Lumamode=false
Redlow=30
>>>>>>> REPLACE
```

**Result (indentation preserved):**

```
[ColorToning]
  Enabled=false
  Method=LabRegions
  Lumamode=false
  Redlow=30
```

## Benefits

1. **More Concise**: AI can focus only on parameters that need to change
2. **Less Error-Prone**: No need to copy/paste long parameter lists
3. **More Flexible**: Works even when the original file has different parameter ordering
4. **Backward Compatible**: Still supports exact matching as a fallback
5. **Preserves Structure**: Maintains indentation, order, and unchanged parameters

## Technical Implementation

The implementation includes:

- **Fuzzy matching algorithm** that identifies sections and parameters
- **Fallback to exact matching** when fuzzy matching isn't applicable
- **Comprehensive test coverage** with 12 test cases
- **Integration with existing workflow** - no breaking changes
- **Updated prompts** to inform AI about the new capability

## Usage in Prompts

The AI prompts now include:

- Rule 5: "You can skip lines in SEARCH blocks - only include parameters you want to change"
- Examples showing line skipping in action
- Clear guidance on when and how to use this feature

This enhancement makes the AI-generated SEARCH/REPLACE blocks more efficient and easier to work with!
