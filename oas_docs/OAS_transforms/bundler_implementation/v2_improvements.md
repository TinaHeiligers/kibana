Key Fixes Applied:
✅ Fixed mutation during traversal - Now collects schemas during `onNodeEnter`, applies changes in `afterTraverse`
✅ Proper schema replacement - Added `replaceInlineSchemasWithRefs()` function
✅ Correct processor ordering - Extract schemas AFTER `allOf` reduction
✅ Deep cloning - Prevents reference issues when extracting schemas
✅ Path-based tracking - Uses path keys to match schemas for replacement
✅ Proper metadata extraction - Extracts method and status code from path
✅ Sanitized naming - Ensures valid schema names
The implementation now follows Kibana's patterns from BundleRefProcessor and properly integrates with the existing processor pipeline.
