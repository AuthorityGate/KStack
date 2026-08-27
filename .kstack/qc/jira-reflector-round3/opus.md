All tools (including Write and ExitPlanMode) are disabled in this session, so the plan file can't be created — the rule is delivered here.

**Round 3 rule**

> **NEVER** add a new event type or a new exit path to a flow whose invariants live in enumerated recognizers or per-path conventions without, in the same change, updating every encoding of that contract — each list that must now recognize the new case, and each obligation the new path must itself perform — or collapsing them into one shared helper that no path can bypass.
>
> **Why:** a contract duplicated across sites fails silently at exactly the site never told about the new case.

Coverage: Defect A is the new event type vs. the enumerated recognizer that must accept it ("each list that must now recognize the new case"); Defect B is the new exit path vs. the obligation its siblings already honor ("each obligation the new path must itself perform").
