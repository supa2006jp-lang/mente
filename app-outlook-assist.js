/**
 * Outlook input helper: prepares plain-text mail drafts for copying into Outlook.
 * Display text is kept as Unicode escapes so this file stays encoding-safe.
 */
(function () {
    const DEFAULT_WRAP_AT = 38;
    const TXT = {
        noCore: '\u57fa\u5e79\u793e\u54e1\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093',
        guestWorker: '\u30b2\u30b9\u30c8',
        guestWorkerNote: '\u57fa\u5e79\u793e\u54e1\u306a\u3057\u3067\u4f7f\u7528',
        openMemberManage: '\u4eba\u540d\u7ba1\u7406\u3092\u958b\u304f',
        noDraft: '\u4e0b\u66f8\u304d\u672a\u8a2d\u5b9a',
        name: '\u540d\u524d',
        selectCoreTitle: '\u57fa\u5e79\u793e\u54e1\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044',
        selectCoreBody: '\u9023\u7d61\u5e33\u306e\u4eba\u540d\u7ba1\u7406\u3067\u57fa\u5e79\u793e\u54e1\u3092\u767b\u9332\u3059\u308b\u3068\u3001\u3053\u306e\u753b\u9762\u3067\u500b\u5225\u306e\u30e1\u30fc\u30eb\u4e0b\u66f8\u304d\u3092\u4f5c\u308c\u307e\u3059\u3002',
        composing: '\u4f5c\u6210\u4e2d',
        draftSuffix: ' \u306e\u30e1\u30fc\u30eb\u4e0b\u66f8\u304d',
        clear: '\u30af\u30ea\u30a2',
        copyAll: '\u5168\u6587\u30b3\u30d4\u30fc',
        copyTo: '\u5b9b\u5148\u30b3\u30d4\u30fc',
        copyCc: 'CC\u30b3\u30d4\u30fc',
        copyBcc: 'BCC\u30b3\u30d4\u30fc',
        to: '\u5b9b\u5148',
        recipientDelimiterHelp: '\u5b9b\u5148\u30fb\u4eba\u540d\u306e\u533a\u5207\u308a\u306f\u300c;\u300d\u307e\u305f\u306f\u300c,\u300d\u3092\u4f7f\u3063\u3066\u304f\u3060\u3055\u3044\u3002\u30b9\u30da\u30fc\u30b9\u533a\u5207\u308a\u306f\u4f7f\u308f\u306a\u3044\u3067\u304f\u3060\u3055\u3044\u3002',
        unregisteredAddress: '\u672a\u767b\u9332',
        addressBook: '\u5b9b\u5148\u7ba1\u7406',
        addressSelect: '\u5b9b\u5148\u9078\u629e',
        addressSearch: '\u5b9b\u5148\u30fb\u30b0\u30eb\u30fc\u30d7\u30fb\u5099\u8003\u3092\u691c\u7d22',
        familyName: '\u82d7\u5b57',
        givenName: '\u4e0b\u306e\u540d\u524d',
        email: '\u30e1\u30eb\u30a2\u30c9',
        group: '\u30b0\u30eb\u30fc\u30d7',
        groupPlaceholder: '\u30b0\u30eb\u30fc\u30d7\uff08\u6700\u5927\u0037\u3064\u30fb\u30ab\u30f3\u30de\u533a\u5207\u308a\uff09',
        groupLimit: '\u30b0\u30eb\u30fc\u30d7\u306f\u6700\u5927\u0037\u3064\u307e\u3067\u3067\u3059',
        note: '\u5099\u8003',
        contacts: '\u9023\u7d61\u5148',
        lastUpdated: '\u6700\u7d42\u66f4\u65b0',
        addGroup: '\u30b0\u30eb\u30fc\u30d7\u4e00\u62ec\u8ffd\u52a0',
        groupManage: '\u30b0\u30eb\u30fc\u30d7\u7ba1\u7406',
        addPersonToGroup: '\u4eba\u3092\u8ffd\u52a0',
        removeFromGroup: '\u30b0\u30eb\u30fc\u30d7\u304b\u3089\u5916\u3059',
        deleteGroup: '\u30b0\u30eb\u30fc\u30d7\u3092\u524a\u9664',
        groupDeleted: '\u30b0\u30eb\u30fc\u30d7\u3092\u524a\u9664\u3057\u307e\u3057\u305f',
        groupUpdated: '\u30b0\u30eb\u30fc\u30d7\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f',
        addToGroup: '\u30b0\u30eb\u30fc\u30d7\u306b\u8ffd\u52a0',
        members: '\u6240\u5c5e',
        notInGroup: '\u672a\u6240\u5c5e',
        emptyGroup: '\u3053\u306e\u30b0\u30eb\u30fc\u30d7\u306f\u9023\u7d61\u5148\u306b\u8a2d\u5b9a\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
        noContact: '\u9023\u7d61\u5148\u306a\u3057',
        noGroup: '\u30b0\u30eb\u30fc\u30d7\u306a\u3057',
        contactRequired: '\u9023\u7d61\u5148\u3092\u767b\u9332\u3057\u3066\u304f\u3060\u3055\u3044',
        emailRequired: '\u30e1\u30fc\u30eb\u30a2\u30c9\u30ec\u30b9\u5fc5\u9808',
        familyRequired: '\u82d7\u5b57\u5fc5\u9808',
        update: '\u66f4\u65b0',
        duplicateEmail: '\u540c\u3058\u30e1\u30eb\u30a2\u30c9\u304c\u65e2\u306b\u3042\u308a\u307e\u3059',
        saved: '\u767b\u9332\u3057\u307e\u3057\u305f',
        removed: '\u524a\u9664\u3057\u307e\u3057\u305f',
        close: '\u9589\u3058\u308b',
        addToTarget: '\u3053\u306e\u5b9b\u5148\u3078\u8ffd\u52a0',
        addToCc: '\u0043\u0043\u3078\u8ffd\u52a0',
        addToBcc: '\u0042\u0043\u0043\u3078\u8ffd\u52a0',
        select: '\u9078\u629e',
        subject: '\u4ef6\u540d',
        machine: '\u5dee\u3057\u8fbc\u307f1',
        insert1Label: '\u5dee\u3057\u8fbc\u307f1\u306e\u8868\u793a\u540d',
        recentInsert1: '\u6700\u8fd1\u306e\u5dee\u3057\u8fbc\u307f1',
        noRecentInsert1: '\u5c65\u6b74\u306a\u3057',
        autoWrap: '\u81ea\u52d5\u6539\u884c',
        mergeWrap: '\u6539\u884c\u6642\u7d50\u5408',
        mergeWrapHelp: '\u30aa\u30f3\u306b\u3059\u308b\u3068\u3001Enter\u3084\u81ea\u52d5\u6539\u884c\u3067\u5206\u304b\u308c\u305f\u6587\u5b57\u3092\u6b21\u306e\u884c\u306e\u5148\u982d\u3078\u3064\u306a\u3052\u307e\u3059',
        chars: '\u6587\u5b57\u6570',
        wrapNow: '\u6539\u884c\u3092\u6574\u3048\u308b',
        unwrapNow: '\u6539\u884c\u3092\u5168\u90e8\u623b\u3059',
        removeBlankLines: '\u7a7a\u884c\u524a\u9664',
        undoBody: '\u623b\u308b',
        redoBody: '\u9032\u3080',
        pageName: '\u30da\u30fc\u30b8\u540d',
        draftPageCount: '\u4e0b\u66f8\u304d',
        duplicateDraftPage: '\u30da\u30fc\u30b8\u8907\u88fd',
        deleteDraftPage: '\u30da\u30fc\u30b8\u524a\u9664',
        draftPageDeleteAsk: '\u3053\u306e\u4e0b\u66f8\u304d\u30da\u30fc\u30b8\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f',
        templateApplyChoice: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u3069\u3053\u306b\u53cd\u6620\u3057\u307e\u3059\u304b\uff1f\n1: \u4eca\u306e\u30da\u30fc\u30b8\u306b\u53cd\u6620\n2: \u65b0\u898f\u30da\u30fc\u30b8\u3092\u4f5c\u3063\u3066\u53cd\u6620\n3: \u30ad\u30e3\u30f3\u30bb\u30eb',
        pageList: '\u30da\u30fc\u30b8\u4e00\u89a7',
        pageColor: '\u30da\u30fc\u30b8\u8272',
        movePageUp: '\u4e0a\u3078',
        movePageDown: '\u4e0b\u3078',
        pageTitleLock: '\u56fa\u5b9a',
        applyCurrentPage: '\u4eca\u306e\u30da\u30fc\u30b8',
        applyNewPage: '\u65b0\u898f\u30da\u30fc\u30b8',
        templatePreview: '\u53cd\u6620\u30d7\u30ec\u30d3\u30e5\u30fc',
        cancel: '\u30ad\u30e3\u30f3\u30bb\u30eb',
        copyBody: '\u672c\u6587\u30b3\u30d4\u30fc',
        copySubject: '\u4ef6\u540d\u30b3\u30d4\u30fc',
        quickPhrases: '\u5b9a\u578b\u53e5',
        phrasePlaceholder: '\u5b9a\u578b\u53e5',
        addPhrase: '\u8ffd\u52a0',
        updatePhrase: '\u66f4\u65b0',
        phraseSaved: '\u5b9a\u578b\u53e5\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f',
        phraseDeleted: '\u5b9a\u578b\u53e5\u3092\u524a\u9664\u3057\u307e\u3057\u305f',
        showPhrase: '\u8868\u793a',
        hidePhrase: '\u975e\u8868\u793a',
        restorePhrase: '\u975e\u8868\u793a\u3092\u518d\u8868\u793a',
        noHiddenPhrase: '\u975e\u8868\u793a\u306e\u5b9a\u578b\u53e5\u306f\u3042\u308a\u307e\u305b\u3093',
        subjectPresets: '\u4ef6\u540d\u30d7\u30ea\u30bb\u30c3\u30c8',
        presetPlaceholder: '\u4ef6\u540d\u30d7\u30ea\u30bb\u30c3\u30c8',
        addPreset: '\u8ffd\u52a0',
        updatePreset: '\u66f4\u65b0',
        editPreset: '\u7de8\u96c6',
        deletePreset: '\u524a\u9664',
        presetSaved: '\u4ef6\u540d\u30d7\u30ea\u30bb\u30c3\u30c8\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f',
        presetDeleted: '\u4ef6\u540d\u30d7\u30ea\u30bb\u30c3\u30c8\u3092\u524a\u9664\u3057\u307e\u3057\u305f',
        recipientCheck: '\u5b9b\u5148\u30c1\u30a7\u30c3\u30af',
        noRecipientIssues: '\u5b9b\u5148\u306b\u5927\u304d\u306a\u554f\u984c\u306f\u3042\u308a\u307e\u305b\u3093',
        nextCopy: '\u6b21\u306b\u30b3\u30d4\u30fc',
        nextCopyDone: '\u5fc5\u8981\u306a\u9805\u76ee\u306f\u30b3\u30d4\u30fc\u6e08\u3067\u3059',
        templateDiff: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u5dee\u5206',
        diffNoChange: '\u7de8\u96c6\u4e2d\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3068\u306e\u5dee\u5206\u306f\u3042\u308a\u307e\u305b\u3093',
        diffBefore: '\u5143',
        diffAfter: '\u4eca',
        fieldChanged: '\u5909\u66f4',
        fieldAdded: '\u8ffd\u52a0',
        fieldRemoved: '\u524a\u9664',
        toMissing: '\u5b9b\u5148\u304c\u7a7a\u3067\u3059',
        duplicateAddress: '\u540c\u3058\u5b9b\u5148\u304c\u5165\u3063\u3066\u3044\u307e\u3059',
        manyTo: '\u5b9b\u5148\u304c\u8907\u6570\u3042\u308a\u307e\u3059',
        copyWithRecipientIssues: '\u5b9b\u5148\u30c1\u30a7\u30c3\u30af\u306b\u8b66\u544a\u304c\u3042\u308a\u307e\u3059\u3002\u305d\u306e\u307e\u307e\u5168\u6587\u30b3\u30d4\u30fc\u3057\u307e\u3059\u304b\uff1f',
        inserted: '\u633f\u5165\u3057\u307e\u3057\u305f',
        prefixAdded: '\u4ef6\u540d\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f',
        bodyPlaceholder: '\u3053\u3053\u306b\u672c\u6587\u3092\u5165\u529b\u3002\u8cbc\u308a\u4ed8\u3051\u305f\u6587\u5b57\u306f\u30d7\u30ec\u30fc\u30f3\u30c6\u30ad\u30b9\u30c8\u306b\u306a\u308a\u307e\u3059\u3002',
        insertVars: '\u5dee\u3057\u8fbc\u307f',
        varDate: '{\u65e5\u4ed8}',
        varMachine: '{\u5dee\u3057\u8fbc\u307f1}',
        subjectInsert: '\u4ef6\u540d\u306b\u5dee\u3057\u8fbc\u307f',
        previewTitle: '\u30b3\u30d4\u30fc\u524d\u30d7\u30ec\u30d3\u30e5\u30fc',
        missingInsert1: '{\u5dee\u3057\u8fbc\u307f1}\u304c\u542b\u307e\u308c\u3066\u3044\u307e\u3059\u304c\u3001\u5dee\u3057\u8fbc\u307f1\u304c\u672a\u5165\u529b\u3067\u3059',
        templates: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8',
        searchApply: '\u984c\u540d\u3067\u691c\u7d22\u3057\u3066\u53cd\u6620',
        register: '\u767b\u9332',
        edit: '\u7de8\u96c6',
        editingTemplate: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u7de8\u96c6\u4e2d',
        overwriteSave: '\u4e0a\u66f8\u304d\u4fdd\u5b58',
        saveAsTemplate: '\u5225\u540d\u4fdd\u5b58',
        cancelEdit: '\u7de8\u96c6\u89e3\u9664',
        editLoaded: '\u7de8\u96c6\u7528\u306b\u8aad\u307f\u8fbc\u307f\u307e\u3057\u305f',
        templateTitle: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u984c\u540d',
        sameTitleWarning: '\u540c\u540d\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3042\u308a\u3002\u767b\u9332\u6642\u306b\u78ba\u8a8d\u5f8c\u3001\u4e0a\u66f8\u304d\u3067\u304d\u307e\u3059\u3002',
        category: '\u5206\u985e',
        categoryAll: '\u5168\u5206\u985e',
        catRequest: '\u4f9d\u983c',
        catReport: '\u5831\u544a',
        catThanks: '\u304a\u793c',
        catReminder: '\u50ac\u4fc3',
        catTrouble: '\u30c8\u30e9\u30d6\u30eb\u9023\u7d61',
        catEstimate: '\u898b\u7a4d',
        catOrder: '\u6ce8\u6587',
        catRawOrder: '\u767a\u6ce8\uff08\u539f\u6599\uff09',
        catOther: '\u305d\u306e\u4ed6',
        templateSearch: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u691c\u7d22',
        noTemplate: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u304c\u3042\u308a\u307e\u305b\u3093',
        duplicate: '\u8907\u88fd',
        duplicateSuffix: '\uff08\u8907\u88fd\uff09',
        favorite: '\u304a\u6c17\u306b\u5165\u308a',
        unfavorite: '\u304a\u6c17\u306b\u5165\u308a\u89e3\u9664',
        color: '\u8272',
        changeColor: '\u8272\u3092\u5909\u66f4',
        clearColor: '\u8272\u3092\u6d88\u3059',
        moveUp: '\u4e0a\u3078',
        moveDown: '\u4e0b\u3078',
        dragTemplate: '\u30c9\u30e9\u30c3\u30b0\u3067\u4e26\u3073\u66ff\u3048',
        sortManual: '\u624b\u52d5\u9806',
        sortRecent: '\u6700\u8fd1\u4f7f\u3063\u305f\u9806',
        sortUsed: '\u4f7f\u7528\u56de\u6570\u9806',
        sortFavorite: '\u304a\u6c17\u306b\u5165\u308a\u9806',
        collapseBodyTop: '\u672c\u6587\u3092\u5927\u304d\u304f',
        expandBodyTop: '\u5165\u529b\u6b04\u3092\u8868\u793a',
        unnamed: '\u540d\u79f0\u672a\u8a2d\u5b9a',
        noSubject: '\u4ef6\u540d\u306a\u3057',
        delete: '\u524a\u9664',
        copied: '\u3057\u307e\u3057\u305f',
        titleRequired: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u984c\u540d\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044',
        templateSavedA: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u300c',
        templateSavedB: '\u300d\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f',
        templateOverwriteAskA: '\u540c\u3058\u984c\u540d\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u300c',
        templateOverwriteAskB: '\u300d\u3092\u4e0a\u66f8\u304d\u3057\u307e\u3059\u304b\uff1f',
        templateAppliedB: '\u300d\u3092\u53cd\u6620\u3057\u307e\u3057\u305f',
        templateDeleteAskA: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u300c',
        templateDeleteAskB: '\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f',
        templateDeleted: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u524a\u9664\u3057\u307e\u3057\u305f',
        templateDuplicated: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u8907\u88fd\u3057\u307e\u3057\u305f',
        undo: '\u5143\u306b\u623b\u3059',
        restored: '\u623b\u3057\u307e\u3057\u305f',
        copyChecklist: '\u8cbc\u308a\u4ed8\u3051\u30c1\u30a7\u30c3\u30af',
        copiedMark: '\u30b3\u30d4\u30fc\u6e08',
        notCopiedMark: '\u672a\u30b3\u30d4\u30fc',
        recipientSets: '\u5b9b\u5148\u30bb\u30c3\u30c8',
        recipientSetName: '\u5b9b\u5148\u30bb\u30c3\u30c8\u540d',
        saveRecipientSet: '\u5b9b\u5148\u30bb\u30c3\u30c8\u767b\u9332',
        noRecipientSet: '\u5b9b\u5148\u30bb\u30c3\u30c8\u306a\u3057',
        apply: '\u53cd\u6620',
        draftClearAsk: ' \u306e\u30e1\u30fc\u30eb\u4e0b\u66f8\u304d\u3092\u30af\u30ea\u30a2\u3057\u307e\u3059\u304b\uff1f',
        exportPersonal: '\u500b\u4eba\u51fa\u529b',
        importPersonal: '\u500b\u4eba\u5165\u529b',
        personalExported: '\u500b\u4eba\u30c7\u30fc\u30bf\u3092\u51fa\u529b\u3057\u307e\u3057\u305f',
        personalImported: '\u500b\u4eba\u30c7\u30fc\u30bf\u3092\u5165\u529b\u3057\u307e\u3057\u305f',
        personalImportInvalid: '\u500b\u4eba\u30c7\u30fc\u30bf\u30d5\u30a1\u30a4\u30eb\u3067\u306f\u3042\u308a\u307e\u305b\u3093',
        personalImportNoWorker: '\u53d6\u308a\u8fbc\u3080\u500b\u4eba\u304c\u9078\u629e\u3055\u308c\u3066\u3044\u307e\u305b\u3093',
        personalImportMismatchA: '\u30d5\u30a1\u30a4\u30eb\u306f\u300c',
        personalImportMismatchB: '\u300d\u7528\u3067\u3059\u3002\u73fe\u5728\u9078\u629e\u4e2d\u306e\u300c',
        personalImportMismatchC: '\u300d\u3078\u53d6\u308a\u8fbc\u307f\u307e\u3059\u304b\uff1f',
        personalImportMissingWorker: '\u540c\u3058\u540d\u524d\u306e\u57fa\u5e79\u793e\u54e1\u304c\u898b\u3064\u304b\u3089\u306a\u3044\u305f\u3081\u3001\u73fe\u5728\u9078\u629e\u4e2d\u306e\u793e\u54e1\u3078\u53d6\u308a\u8fbc\u307f\u307e\u3059\u304b\uff1f',
        exportDraft: '\u4e0b\u66f8\u304d',
        exportCopyStatus: '\u30b3\u30d4\u30fc\u72b6\u614b',
        exportTemplates: '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8',
        exportAddressBook: '\u5b9b\u5148\u5e33',
        importOverwriteChoice: '\u5165\u529b\u524d\u306b\u73fe\u5728\u306e\u4e0b\u66f8\u304d\u3092\u3069\u3046\u3057\u307e\u3059\u304b\uff1f\n1: \u4e0a\u66f8\u304d\n2: \u30d0\u30c3\u30af\u30a2\u30c3\u30d7\u3057\u3066\u4e0a\u66f8\u304d\n3: \u30ad\u30e3\u30f3\u30bb\u30eb',
        draftBackedUp: '\u73fe\u5728\u306e\u4e0b\u66f8\u304d\u3092\u30d0\u30c3\u30af\u30a2\u30c3\u30d7\u3057\u307e\u3057\u305f',
        colorFilter: '\u8272\u30d5\u30a3\u30eb\u30bf\u30fc',
        colorAll: '\u5168\u8272',
        colorAny: '\u8272\u3042\u308a',
        colorNone: '\u8272\u306a\u3057',
        colorRed: '\u8d64',
        colorYellow: '\u9ec4',
        colorGreen: '\u7dd1',
        colorBlue: '\u9752',
        colorGray: '\u7070',
        colorPresets: '\u8272\u30d7\u30ea\u30bb\u30c3\u30c8',
        compactCards: '\u30b3\u30f3\u30d1\u30af\u30c8',
        groupColor: '\u30b0\u30eb\u30fc\u30d7\u8272',
        usedCount: '\u4f7f\u7528',
        times: '\u56de',
        lastUsed: '\u6700\u7d42\u4f7f\u7528',
        importPreviewTitle: '\u5165\u529b\u524d\u30d7\u30ec\u30d3\u30e5\u30fc',
        previewWorker: '\u5bfe\u8c61',
        previewIncludes: '\u5185\u5bb9',
        previewBody: '\u672c\u6587\u5192\u982d',
        previewNoBody: '\u672c\u6587\u306a\u3057',
        addressBookDiffTitle: '\u5b9b\u5148\u5e33\u5dee\u5206',
        newContacts: '\u65b0\u898f\u9023\u7d61\u5148',
        updateContacts: '\u66f4\u65b0\u9023\u7d61\u5148',
        newRecipientSets: '\u65b0\u898f\u5b9b\u5148\u30bb\u30c3\u30c8',
        updateRecipientSets: '\u66f4\u65b0\u5b9b\u5148\u30bb\u30c3\u30c8',
        groups: '\u30b0\u30eb\u30fc\u30d7',
        importProceed: '\u3053\u306e\u5185\u5bb9\u3067\u5165\u529b\u3057\u307e\u3059\u304b\uff1f',
        addressBookImported: '\u5b9b\u5148\u5e33\u30c7\u30fc\u30bf\u3092\u5165\u529b\u3057\u307e\u3057\u305f',
        mailTo: '\u5b9b\u5148: ',
        mailCc: 'CC: ',
        mailBcc: 'BCC: ',
        mailSubject: '\u4ef6\u540d: '
    };
    const TEMPLATE_CATEGORIES = [
        { id: 'estimate', label: TXT.catEstimate },
        { id: 'order', label: TXT.catOrder },
        { id: 'raw_order', label: TXT.catRawOrder },
        { id: 'request', label: TXT.catRequest },
        { id: 'report', label: TXT.catReport },
        { id: 'trouble', label: TXT.catTrouble },
        { id: 'reminder', label: TXT.catReminder },
        { id: 'thanks', label: TXT.catThanks },
        { id: 'other', label: TXT.catOther }
    ];
    const TEMPLATE_CATEGORY_IDS = new Set(TEMPLATE_CATEGORIES.map(item => item.id));
    const DEFAULT_QUICK_PHRASES = [
        '\u304a\u4e16\u8a71\u306b\u306a\u3063\u3066\u304a\u308a\u307e\u3059\u3002',
        '\u3054\u78ba\u8a8d\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002',
        '\u3054\u5bfe\u5fdc\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002',
        '\u4ee5\u4e0a\u3001\u3088\u308d\u3057\u304f\u304a\u9858\u3044\u3044\u305f\u3057\u307e\u3059\u3002'
    ];
    const DEFAULT_SUBJECT_PRESETS = [
        '[\u898b\u7a4d\u4f9d\u983c]',
        '[\u6ce8\u6587]',
        '[\u767a\u6ce8]',
        '[\u78ba\u8a8d\u4f9d\u983c]',
        '[\u5831\u544a]'
    ];
    const TEMPLATE_COLOR_PRESETS = [
        { id: 'red', label: TXT.colorRed, color: '#fecaca' },
        { id: 'yellow', label: TXT.colorYellow, color: '#fef08a' },
        { id: 'green', label: TXT.colorGreen, color: '#bbf7d0' },
        { id: 'blue', label: TXT.colorBlue, color: '#bfdbfe' },
        { id: 'gray', label: TXT.colorGray, color: '#e2e8f0' }
    ];
    const DRAFT_PAGE_COLOR_PRESETS = [
        { id: 'none', label: TXT.colorNone, color: '' },
        ...TEMPLATE_COLOR_PRESETS
    ];

    function getState() {
        const data = store.activeData;
        if (!data.outlookAssist || typeof data.outlookAssist !== 'object') {
            data.outlookAssist = { selectedWorker: '', draftsByWorker: {}, templates: [] };
        }
        if (!data.outlookAssist.draftsByWorker || typeof data.outlookAssist.draftsByWorker !== 'object') data.outlookAssist.draftsByWorker = {};
        if (!data.outlookAssist.draftPagesByWorker || typeof data.outlookAssist.draftPagesByWorker !== 'object') data.outlookAssist.draftPagesByWorker = {};
        if (!data.outlookAssist.draftPageIndexByWorker || typeof data.outlookAssist.draftPageIndexByWorker !== 'object') data.outlookAssist.draftPageIndexByWorker = {};
        if (!Array.isArray(data.outlookAssist.templates)) data.outlookAssist.templates = [];
        if (!Array.isArray(data.outlookAssist.recipientSets)) data.outlookAssist.recipientSets = [];
        if (!Array.isArray(data.outlookAssist.recipientContacts)) data.outlookAssist.recipientContacts = [];
        if (!data.outlookAssist.recipientGroupUpdatedAt || typeof data.outlookAssist.recipientGroupUpdatedAt !== 'object') data.outlookAssist.recipientGroupUpdatedAt = {};
        if (!data.outlookAssist.recipientGroupColors || typeof data.outlookAssist.recipientGroupColors !== 'object') data.outlookAssist.recipientGroupColors = {};
        if (!Array.isArray(data.outlookAssist.insertHistory)) data.outlookAssist.insertHistory = [];
        if (!Array.isArray(data.outlookAssist.subjectPresets)) data.outlookAssist.subjectPresets = [...DEFAULT_SUBJECT_PRESETS];
        if (!Array.isArray(data.outlookAssist.quickPhrases)) {
            data.outlookAssist.quickPhrases = DEFAULT_QUICK_PHRASES.map(text => ({ text, visible: true }));
        } else {
            data.outlookAssist.quickPhrases = data.outlookAssist.quickPhrases
                .map(item => typeof item === 'string' ? { text: item, visible: true } : { text: String(item?.text || '').trim(), visible: item?.visible !== false })
                .filter(item => item.text);
        }
        if (!data.outlookAssist.copyStatus || typeof data.outlookAssist.copyStatus !== 'object') data.outlookAssist.copyStatus = {};
        if (!data.outlookAssist.personalExportOptions || typeof data.outlookAssist.personalExportOptions !== 'object') {
            data.outlookAssist.personalExportOptions = { draft: true, copyStatus: true, templates: false, addressBook: false };
        }
        data.outlookAssist.personalExportOptions = {
            draft: data.outlookAssist.personalExportOptions.draft !== false,
            copyStatus: data.outlookAssist.personalExportOptions.copyStatus !== false,
            templates: !!data.outlookAssist.personalExportOptions.templates,
            addressBook: !!data.outlookAssist.personalExportOptions.addressBook
        };
        if (typeof data.outlookAssist.templateFilterCategory !== 'string') data.outlookAssist.templateFilterCategory = 'all';
        if (data.outlookAssist.templateFilterCategory !== 'all' && !TEMPLATE_CATEGORY_IDS.has(data.outlookAssist.templateFilterCategory)) data.outlookAssist.templateFilterCategory = 'all';
        if (typeof data.outlookAssist.templateFilterColor !== 'string') data.outlookAssist.templateFilterColor = 'all';
        if (!['manual', 'recent', 'used', 'favorite'].includes(data.outlookAssist.templateSortMode)) data.outlookAssist.templateSortMode = 'manual';
        if (typeof data.outlookAssist.showTemplateColorPresets !== 'boolean') data.outlookAssist.showTemplateColorPresets = false;
        if (typeof data.outlookAssist.compactTemplateCards !== 'boolean') data.outlookAssist.compactTemplateCards = false;
        if (typeof data.outlookAssist.bodyTopCollapsed !== 'boolean') data.outlookAssist.bodyTopCollapsed = false;
        data.outlookAssist.templates.forEach((template, index) => {
            if (!Number.isFinite(Number(template.order))) template.order = index;
            template.favorite = !!template.favorite;
            template.cardColor = normalizeOutlookAssistTemplateColor(template.cardColor);
            template.useCount = Math.max(0, Number(template.useCount) || 0);
            template.lastUsedAt = String(template.lastUsedAt || '');
        });
        data.outlookAssist.recipientContacts = data.outlookAssist.recipientContacts.map(contact => ({
            id: contact.id || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            familyName: String(contact.familyName || '').trim(),
            givenName: String(contact.givenName || '').trim(),
            email: String(contact.email || '').trim(),
            group: normalizeOutlookAssistGroups(contact.groups || contact.group)[0] || '',
            groups: normalizeOutlookAssistGroups(contact.groups || contact.group),
            note: String(contact.note || '').trim(),
            updatedAt: contact.updatedAt || new Date().toISOString()
        })).filter(contact => contact.familyName || contact.email);
        return data.outlookAssist;
    }

    function createEmptyDraft() {
        return { pageTitle: '', pageTitleLocked: false, pageColor: '', to: '', cc: '', bcc: '', subject: '', body: '', wrapAt: DEFAULT_WRAP_AT, autoWrap: true, insertLabel: TXT.machine };
    }

    function normalizeOutlookAssistDraftRecord(value = {}) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            ...createEmptyDraft(),
            pageTitle: String(source.pageTitle || ''),
            pageTitleLocked: !!source.pageTitleLocked,
            pageColor: normalizeOutlookAssistTemplateColor(source.pageColor || ''),
            to: String(source.to || ''),
            cc: String(source.cc || ''),
            bcc: String(source.bcc || ''),
            subject: String(source.subject || ''),
            body: String(source.body || ''),
            machineName: String(source.machineName || ''),
            insertLabel: String(source.insertLabel || TXT.machine),
            wrapAt: Math.max(10, Math.min(120, Number(source.wrapAt) || DEFAULT_WRAP_AT)),
            autoWrap: source.autoWrap !== false,
            updatedAt: source.updatedAt || new Date().toISOString()
        };
    }

    function sanitizeOutlookAssistFileName(value) {
        return String(value || 'outlook').trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60) || 'outlook';
    }

    function normalizePlainText(text) {
        return String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n');
    }

    function normalizeOutlookAssistTemplateColor(value) {
        const color = String(value || '').trim();
        return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '';
    }

    function getReadableTextColor(backgroundColor) {
        const color = normalizeOutlookAssistTemplateColor(backgroundColor);
        if (!color) return '';
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return ((r * 299 + g * 587 + b * 114) / 1000) < 150 ? '#ffffff' : '#0f172a';
    }

    function wrapParagraph(paragraph, limit) {
        const chars = Array.from(paragraph);
        if (!Number.isFinite(limit) || limit < 10 || chars.length <= limit) return paragraph;
        const lines = [];
        let line = '';
        chars.forEach(char => {
            line += char;
            if (Array.from(line).length >= limit) {
                lines.push(line.trimEnd());
                line = '';
            }
        });
        if (line) lines.push(line.trimEnd());
        return lines.join('\n');
    }

    function wrapText(text, limit) {
        const safeLimit = Math.max(10, Math.min(120, Number(limit) || DEFAULT_WRAP_AT));
        return normalizePlainText(text).split('\n').map(line => wrapParagraph(line, safeLimit)).join('\n');
    }

    function unwrapText(text) {
        return normalizePlainText(text)
            .split(/\n{2,}/)
            .map(block => block.split('\n').map(line => line.trim()).filter(Boolean).join(''))
            .join('\n\n');
    }

    function getFieldValue(id) {
        return document.getElementById(id)?.value || '';
    }

    function normalizeOutlookAssistGroups(value) {
        const source = Array.isArray(value) ? value.join(',') : String(value || '');
        return [...new Set(source.split(/[,\u3001;\n]+/).map(item => item.trim()).filter(Boolean))].slice(0, 7);
    }

    function formatUpdatedAt(iso) {
        if (!iso) return '';
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '';
        const today = new Date();
        const sameDay = date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return sameDay ? `\u4eca\u65e5 ${hh}:${min}` : `${mm}/${dd} ${hh}:${min}`;
    }

    function wrapTextByMergingNextLine(text, limit = DEFAULT_WRAP_AT) {
        const width = Math.max(10, Number(limit) || DEFAULT_WRAP_AT);
        const lines = String(text || '').split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            while (lines[i].length > width) {
                const overflow = lines[i].slice(width);
                lines[i] = lines[i].slice(0, width);
                if (i + 1 >= lines.length) lines.push(overflow);
                else lines[i + 1] = overflow + lines[i + 1];
                i += 1;
            }
        }
        return lines.join('\n');
    }

    function setTextareaValuePreservingCursor(textarea, nextValue, transformPrefix) {
        if (!textarea || textarea.value === nextValue) return;
        const current = textarea.value;
        const start = textarea.selectionStart ?? current.length;
        const end = textarea.selectionEnd ?? start;
        textarea.value = nextValue;
        if (typeof textarea.setSelectionRange !== 'function') return;
        const mapCursor = position => {
            const prefix = current.slice(0, Math.max(0, position));
            return Math.max(0, Math.min(nextValue.length, transformPrefix(prefix).length));
        };
        textarea.setSelectionRange(mapCursor(start), mapCursor(end));
    }

    Object.assign(MaintenanceApp.prototype, {
        getOutlookAssistState: getState,

        getOutlookAssistCopyStatusKey(worker = this.getOutlookAssistState().selectedWorker || '') {
            const key = String(worker || '').trim();
            if (!key) return '';
            return `${key}::${this.getOutlookAssistDraftPageIndex(key)}`;
        },

        getOutlookAssistCopyStatus(worker = this.getOutlookAssistState().selectedWorker || '') {
            const state = this.getOutlookAssistState();
            const key = this.getOutlookAssistCopyStatusKey(worker);
            const pageIndex = this.getOutlookAssistDraftPageIndex(worker);
            if (!state.copyStatus[key] || typeof state.copyStatus[key] !== 'object') {
                state.copyStatus[key] = pageIndex === 0 && state.copyStatus[worker] && typeof state.copyStatus[worker] === 'object'
                    ? { ...state.copyStatus[worker] }
                    : {};
            }
            return state.copyStatus[key];
        },

        getNextOutlookAssistTemplateOrder() {
            const orders = (this.getOutlookAssistState().templates || []).map(t => Number(t.order)).filter(Number.isFinite);
            return orders.length ? Math.max(...orders) + 1 : 1;
        },

        sortOutlookAssistTemplates(templates = this.getOutlookAssistState().templates, mode = this.getOutlookAssistState().templateSortMode || 'manual') {
            return [...(templates || [])].sort((a, b) => {
                if (mode === 'favorite') {
                    const favDiff = (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
                    if (favDiff) return favDiff;
                }
                if (mode === 'used') {
                    const useDiff = (Number(b.useCount) || 0) - (Number(a.useCount) || 0);
                    if (useDiff) return useDiff;
                }
                if (mode === 'recent') {
                    const recentDiff = String(b.lastUsedAt || '').localeCompare(String(a.lastUsedAt || ''));
                    if (recentDiff) return recentDiff;
                }
                const orderDiff = (Number(a.order) || 999999) - (Number(b.order) || 999999);
                if (orderDiff) return orderDiff;
                return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            });
        },

        getOutlookAssistTemplateSortOptions(selected = 'manual') {
            const options = [
                { id: 'manual', label: TXT.sortManual },
                { id: 'recent', label: TXT.sortRecent },
                { id: 'used', label: TXT.sortUsed },
                { id: 'favorite', label: TXT.sortFavorite }
            ];
            return options.map(item => `<option value="${this.escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${this.escapeHtml(item.label)}</option>`).join('');
        },

        recordOutlookAssistInsertHistory(value) {
            const text = String(value || '').trim();
            if (!text) return;
            const state = this.getOutlookAssistState();
            state.insertHistory = [text, ...(state.insertHistory || []).filter(item => item !== text)].slice(0, 12);
        },

        getOutlookAssistTemplateCategoryLabel(category) {
            return TEMPLATE_CATEGORIES.find(item => item.id === category)?.label || TXT.catOther;
        },

        getOutlookAssistTemplateCategoryId(category) {
            return TEMPLATE_CATEGORY_IDS.has(category) ? category : 'other';
        },

        getOutlookAssistTemplateTitleWarningHtml(title = document.getElementById('outlook-template-title')?.value || '') {
            const normalized = String(title || '').trim();
            if (!normalized) return '';
            const editingId = this._outlookAssistEditingTemplateId || '';
            return this.getOutlookAssistState().templates.some(t => t.title === normalized && t.id !== editingId)
                ? `<div class="outlook-template-title-warning"><i class="fa-solid fa-triangle-exclamation"></i>${TXT.sameTitleWarning}</div>`
                : '';
        },

        getOutlookAssistEditingTemplate() {
            const id = this._outlookAssistEditingTemplateId || '';
            return id ? this.getOutlookAssistState().templates.find(t => t.id === id) || null : null;
        },

        getOutlookAssistVariableMap(overrides = {}) {
            const draft = this.getCurrentOutlookAssistDraft();
            const now = new Date();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            return {
                [TXT.varDate]: `${m}/${d}`,
                [TXT.varMachine]: overrides.machineName ?? draft.machineName ?? ''
            };
        },

        getOutlookAssistInsertLabel() {
            const draft = this.getCurrentOutlookAssistDraft();
            return String(draft.insertLabel || TXT.machine).trim() || TXT.machine;
        },

        getOutlookAssistMissingInsertWarning(draft = this.getCurrentOutlookAssistDraft()) {
            const hasToken = ['to', 'cc', 'bcc', 'subject', 'body'].some(field => String(draft[field] || '').includes(TXT.varMachine));
            return hasToken && !String(draft.machineName || '').trim() ? TXT.missingInsert1 : '';
        },

        splitOutlookAssistRecipients(value) {
            return String(value || '').split(/[;,]+/).map(item => item.trim()).filter(Boolean);
        },

        getOutlookAssistRecipientDisplay(value) {
            const contacts = this.getOutlookAssistState().recipientContacts || [];
            const contactByEmail = new Map(contacts.map(contact => [String(contact.email || '').toLowerCase(), contact]));
            return this.splitOutlookAssistRecipients(value).map(item => {
                const contact = contactByEmail.get(String(item || '').toLowerCase());
                return contact ? (contact.familyName || this.getOutlookAssistContactName(contact)) : item;
            }).join('; ');
        },

        resolveOutlookAssistRecipientItem(value) {
            const text = String(value || '').trim();
            if (!text) return '';
            const normalized = MaintenanceApp.toHalfWidthLower(text);
            const contacts = this.getOutlookAssistState().recipientContacts || [];
            const byEmail = contacts.find(contact => MaintenanceApp.toHalfWidthLower(contact.email || '') === normalized);
            if (byEmail) return byEmail.email;
            const byName = contacts.filter(contact => {
                const familyName = MaintenanceApp.toHalfWidthLower(contact.familyName || '');
                const fullName = MaintenanceApp.toHalfWidthLower(this.getOutlookAssistContactName(contact));
                return familyName === normalized || fullName === normalized;
            });
            return byName.length === 1 ? byName[0].email : text;
        },

        normalizeOutlookAssistRecipientItems(items) {
            const unique = [];
            const seen = new Set();
            (items || []).forEach(item => {
                const resolved = this.resolveOutlookAssistRecipientItem(item);
                const key = MaintenanceApp.toHalfWidthLower(resolved);
                if (!key || seen.has(key)) return;
                seen.add(key);
                unique.push(resolved);
            });
            return unique;
        },

        getOutlookAssistRecipientDatalistHtml() {
            const contacts = this.getOutlookAssistState().recipientContacts || [];
            return `<datalist id="outlook-recipient-candidates">${contacts.map(contact => `<option value="${this.escapeHtml(contact.email || '')}" label="${this.escapeHtml(this.getOutlookAssistContactName(contact))}"></option>`).join('')}</datalist>`;
        },

        getOutlookAssistRecipientChipsHtml(field, value) {
            const contacts = this.getOutlookAssistState().recipientContacts || [];
            const contactByEmail = new Map(contacts.map(contact => [String(contact.email || '').toLowerCase(), contact]));
            const items = this.splitOutlookAssistRecipients(value);
            if (!items.length) return '';
            return `<div class="outlook-recipient-chip-row">${items.map((item, index) => {
                const contact = contactByEmail.get(String(item || '').toLowerCase());
                const label = contact ? (contact.familyName || this.getOutlookAssistContactName(contact)) : item;
                return `<span class="outlook-recipient-chip ${contact ? '' : 'unregistered'}"><b>${this.escapeHtml(label)}</b><button type="button" onclick="app.removeOutlookAssistRecipientChip('${this.escapeJs(field)}', ${index})"><i class="fa-solid fa-xmark"></i></button></span>`;
            }).join('')}</div>`;
        },

        removeOutlookAssistRecipientChip(field, index) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            const draft = this.getCurrentOutlookAssistDraft();
            const items = this.splitOutlookAssistRecipients(draft[field] || '');
            items.splice(index, 1);
            if (worker) {
                this.setCurrentOutlookAssistDraft({
                    ...draft,
                    [field]: items.join('; '),
                    updatedAt: new Date().toISOString()
                });
                store.save();
            }
            this.renderOutlookAssist();
        },

        focusOutlookAssistRecipientField(field) {
            const input = document.getElementById(`outlook-assist-${field}`);
            if (!input) return;
            const draft = this.getCurrentOutlookAssistDraft();
            const current = draft[field] || '';
            input.dataset.baseRecipients = current;
            input.value = this.splitOutlookAssistRecipients(current).length ? '' : current;
        },

        onOutlookAssistRecipientInput(field) {
            const input = document.getElementById(`outlook-assist-${field}`);
            if (!input) return;
            const hasBase = this.splitOutlookAssistRecipients(input.dataset.baseRecipients || '').length > 0;
            if (hasBase) {
                this.renderOutlookAssistPreview();
                this.renderOutlookAssistAssistPanels();
                return;
            }
            this.saveOutlookAssistDraftFromForm();
        },

        blurOutlookAssistRecipientField(field) {
            this.commitOutlookAssistRecipientField(field, true);
        },

        getOutlookAssistRecipientIssues(draft = this.getCurrentOutlookAssistDraft()) {
            const to = this.splitOutlookAssistRecipients(this.applyOutlookAssistVariables(draft.to || ''));
            const cc = this.splitOutlookAssistRecipients(this.applyOutlookAssistVariables(draft.cc || ''));
            const bcc = this.splitOutlookAssistRecipients(this.applyOutlookAssistVariables(draft.bcc || ''));
            const all = [...to, ...cc, ...bcc].map(item => item.toLowerCase());
            const issues = [];
            if (!to.length) issues.push(TXT.toMissing);
            if (to.length > 1) issues.push(TXT.manyTo);
            if (all.some((item, index) => all.indexOf(item) !== index)) issues.push(TXT.duplicateAddress);
            return issues;
        },

        getOutlookAssistRecipientCheckHtml(draft = this.getCurrentOutlookAssistDraft()) {
            const issues = this.getOutlookAssistRecipientIssues(draft);
            return `
                <div id="outlook-recipient-check" class="outlook-recipient-check ${issues.length ? 'warn' : 'ok'}" ${issues.length ? '' : 'hidden'}>
                    <b><i class="fa-solid ${issues.length ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>${TXT.recipientCheck}</b>
                    <span>${issues.length ? issues.map(item => this.escapeHtml(item)).join(' / ') : TXT.noRecipientIssues}</span>
                </div>
            `;
        },

        getOutlookAssistNextCopyHtml() {
            const draft = this.getCurrentOutlookAssistDraft();
            const status = this.getOutlookAssistCopyStatus();
            const order = [
                ['to', TXT.to, draft.to],
                ['cc', 'CC', draft.cc],
                ['bcc', 'BCC', draft.bcc],
                ['subject', TXT.subject, draft.subject],
                ['body', TXT.copyBody, draft.body]
            ];
            const required = new Set(['to', 'subject', 'body']);
            const target = order.find(([field, , value]) => (required.has(field) || String(value || '').trim()) && !status[field]);
            return `
                <div id="outlook-next-copy-guide" class="outlook-next-copy-guide ${target ? '' : 'done'}">
                    <b><i class="fa-regular fa-hand-point-right"></i>${TXT.nextCopy}</b>
                    <span>${target ? this.escapeHtml(target[1]) : TXT.nextCopyDone}</span>
                </div>
            `;
        },

        getOutlookAssistQuickPhrasesHtml() {
            const phrases = this.getOutlookAssistState().quickPhrases || [];
            const editingIndex = Number.isInteger(this._outlookAssistEditingQuickPhraseIndex) ? this._outlookAssistEditingQuickPhraseIndex : -1;
            const editingValue = editingIndex >= 0 ? phrases[editingIndex]?.text || '' : '';
            const visiblePhrases = phrases.map((phrase, index) => ({ phrase, index })).filter(item => item.phrase.visible !== false);
            const hiddenPhrases = phrases.map((phrase, index) => ({ phrase, index })).filter(item => item.phrase.visible === false);
            const showHidden = !!this._outlookAssistShowHiddenQuickPhrases;
            return `
                <div class="outlook-quick-phrases">
                    <span>${TXT.quickPhrases}</span>
                    <div class="outlook-quick-phrase-list">
                        ${visiblePhrases.map(({ phrase, index }) => {
                            const text = phrase.text || '';
                            return `
                                <div class="outlook-quick-phrase-chip ${index === editingIndex ? 'editing' : ''}">
                                    <button type="button" class="phrase-insert" onclick="app.insertOutlookAssistQuickPhrase('${this.escapeJs(text)}')">${this.escapeHtml(text)}</button>
                                    <button type="button" class="phrase-toggle" title="${TXT.hidePhrase}" onclick="app.toggleOutlookAssistQuickPhraseVisible(${index})"><i class="fa-solid fa-eye"></i></button>
                                    <button type="button" class="phrase-edit" title="${TXT.editPreset}" onclick="app.editOutlookAssistQuickPhrase(${index})"><i class="fa-solid fa-pen"></i></button>
                                    <button type="button" class="phrase-delete" title="${TXT.deletePreset}" onclick="app.deleteOutlookAssistQuickPhrase(${index})"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="outlook-quick-phrase-restore">
                        <button type="button" onclick="app.toggleOutlookAssistHiddenQuickPhrasesPanel()"><i class="fa-solid fa-eye-slash"></i> ${TXT.restorePhrase}</button>
                        ${showHidden ? `
                            <div class="outlook-quick-phrase-hidden-list">
                                ${hiddenPhrases.length ? hiddenPhrases.map(({ phrase, index }) => `<button type="button" onclick="app.restoreOutlookAssistQuickPhrase(${index})">${this.escapeHtml(phrase.text || '')}</button>`).join('') : `<small>${TXT.noHiddenPhrase}</small>`}
                            </div>
                        ` : ''}
                    </div>
                    <div class="outlook-quick-phrase-editor">
                        <input id="outlook-quick-phrase-input" value="${this.escapeHtml(editingValue)}" placeholder="${TXT.phrasePlaceholder}">
                        <button type="button" onclick="app.saveOutlookAssistQuickPhrase()"><i class="fa-solid fa-plus"></i> ${editingIndex >= 0 ? TXT.updatePhrase : TXT.addPhrase}</button>
                    </div>
                </div>
            `;
        },

        getOutlookAssistSubjectPresetsHtml() {
            const presets = this.getOutlookAssistState().subjectPresets || [];
            const editingIndex = Number.isInteger(this._outlookAssistEditingSubjectPresetIndex) ? this._outlookAssistEditingSubjectPresetIndex : -1;
            const editingValue = editingIndex >= 0 ? presets[editingIndex] || '' : '';
            return `
                <div class="outlook-subject-preset-bar">
                    <span>${TXT.subjectPresets}</span>
                    <div class="outlook-subject-preset-list">
                        ${presets.map((prefix, index) => `
                            <div class="outlook-subject-preset-chip ${index === editingIndex ? 'editing' : ''}">
                                <button type="button" class="preset-insert" onclick="app.addOutlookAssistSubjectPreset('${this.escapeJs(prefix)}')">${this.escapeHtml(prefix)}</button>
                                <button type="button" class="preset-edit" title="${TXT.editPreset}" onclick="app.editOutlookAssistSubjectPreset(${index})"><i class="fa-solid fa-pen"></i></button>
                                <button type="button" class="preset-delete" title="${TXT.deletePreset}" onclick="app.deleteOutlookAssistSubjectPreset(${index})"><i class="fa-solid fa-xmark"></i></button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="outlook-subject-preset-editor">
                        <input id="outlook-subject-preset-input" value="${this.escapeHtml(editingValue)}" placeholder="${TXT.presetPlaceholder}">
                        <button type="button" onclick="app.saveOutlookAssistSubjectPreset()"><i class="fa-solid fa-plus"></i> ${editingIndex >= 0 ? TXT.updatePreset : TXT.addPreset}</button>
                    </div>
                </div>
            `;
        },

        getOutlookAssistTemplateDiffHtml() {
            const template = this.getOutlookAssistEditingTemplate();
            if (!template) return '';
            const draft = this.getCurrentOutlookAssistDraft();
            const fields = [
                ['to', TXT.to],
                ['cc', 'CC'],
                ['bcc', 'BCC'],
                ['subject', TXT.subject],
                ['body', TXT.copyBody]
            ];
            const rows = fields.map(([field, label]) => {
                const before = String(template[field] || '');
                const after = String(draft[field] || '');
                if (before === after) return '';
                const change = before && after ? TXT.fieldChanged : (after ? TXT.fieldAdded : TXT.fieldRemoved);
                return `
                    <div class="outlook-template-diff-row">
                        <b>${this.escapeHtml(label)} <em>${change}</em></b>
                        <small>${TXT.diffBefore}: ${this.escapeHtml(before || '-')}</small>
                        <small>${TXT.diffAfter}: ${this.escapeHtml(after || '-')}</small>
                    </div>
                `;
            }).filter(Boolean).join('');
            return `
                <div id="outlook-template-diff" class="outlook-template-diff">
                    <div><i class="fa-solid fa-code-compare"></i>${TXT.templateDiff}</div>
                    ${rows || `<p>${TXT.diffNoChange}</p>`}
                </div>
            `;
        },

        hasOutlookAssistTemplateEditChanges(template = this.getOutlookAssistEditingTemplate()) {
            if (!template) return false;
            this.saveOutlookAssistDraftFromForm();
            const draft = this.getCurrentOutlookAssistDraft();
            const title = (document.getElementById('outlook-template-title')?.value || '').trim();
            const category = document.getElementById('outlook-template-category')?.value || 'other';
            const insertLabel = (document.getElementById('outlook-template-insert-label')?.value || TXT.machine).trim();
            const checks = [
                [template.title || '', title || template.title || ''],
                [this.getOutlookAssistTemplateCategoryId(template.category || 'other'), category],
                [template.insertLabel || TXT.machine, insertLabel || TXT.machine],
                [template.to || '', draft.to || ''],
                [template.cc || '', draft.cc || ''],
                [template.bcc || '', draft.bcc || ''],
                [template.subject || '', draft.subject || ''],
                [template.machineName || '', draft.machineName || ''],
                [template.body || '', draft.body || ''],
                [String(template.wrapAt || DEFAULT_WRAP_AT), String(draft.wrapAt || DEFAULT_WRAP_AT)]
            ];
            return checks.some(([before, after]) => String(before) !== String(after));
        },

        getOutlookAssistCopyChecklistHtml() {
            const status = this.getOutlookAssistCopyStatus();
            const items = [
                ['to', TXT.to],
                ['cc', 'CC'],
                ['bcc', 'BCC'],
                ['subject', TXT.subject],
                ['body', TXT.copyBody]
            ];
            return `
                <div class="outlook-copy-checklist">
                    <b>${TXT.copyChecklist}</b>
                    ${items.map(([field, label]) => `<span class="${status[field] ? 'done' : ''}"><i class="fa-solid ${status[field] ? 'fa-check' : 'fa-minus'}"></i>${this.escapeHtml(label)} ${status[field] ? TXT.copiedMark : TXT.notCopiedMark}</span>`).join('')}
                </div>
            `;
        },

        getOutlookAssistInsertHistoryHtml() {
            const items = this.getOutlookAssistState().insertHistory || [];
            return `
                <div class="outlook-insert-history">
                    <span>${TXT.recentInsert1}</span>
                    ${items.length ? items.map(item => `<button type="button" onclick="app.applyOutlookAssistInsertHistory('${this.escapeJs(item)}')">${this.escapeHtml(item)}</button>`).join('') : `<small>${TXT.noRecentInsert1}</small>`}
                </div>
            `;
        },

        getOutlookAssistRecipientSetsHtml() {
            const sets = this.getOutlookAssistState().recipientSets || [];
            return `
                <div class="outlook-recipient-sets">
                    <div class="outlook-recipient-set-form">
                        <input id="outlook-recipient-set-name" placeholder="${TXT.recipientSetName}">
                        <button type="button" class="secondary-btn" onclick="app.saveOutlookAssistRecipientSet()"><i class="fa-solid fa-floppy-disk"></i> ${TXT.saveRecipientSet}</button>
                    </div>
                    <div id="outlook-recipient-set-list" class="outlook-recipient-set-list">
                        ${sets.length ? sets.map(set => `
                            <div class="outlook-recipient-set-item">
                                <button type="button" onclick="app.applyOutlookAssistRecipientSet('${this.escapeJs(set.id)}')">
                                    <b>${this.escapeHtml(set.name || TXT.unnamed)}</b>
                                    <span>${this.escapeHtml(set.to || TXT.noDraft)}</span>
                                </button>
                                <button type="button" class="icon-btn danger" title="${TXT.delete}" onclick="app.deleteOutlookAssistRecipientSet('${this.escapeJs(set.id)}')"><i class="fa-solid fa-trash-can"></i></button>
                            </div>
                        `).join('') : `<div class="outlook-template-empty">${TXT.noRecipientSet}</div>`}
                    </div>
                </div>
            `;
        },

        getOutlookAssistContactName(contact) {
            return `${contact.familyName || ''}${contact.givenName ? ` ${contact.givenName}` : ''}`.trim() || contact.email || TXT.unnamed;
        },

        getOutlookAssistGroupColor(group) {
            const state = this.getOutlookAssistState();
            return normalizeOutlookAssistTemplateColor(state.recipientGroupColors?.[group]) || '';
        },

        setOutlookAssistGroupColor(group, color) {
            const groupName = String(group || '').trim();
            if (!groupName || groupName === TXT.noGroup) return;
            const state = this.getOutlookAssistState();
            state.recipientGroupColors[groupName] = normalizeOutlookAssistTemplateColor(color) || '';
            this.touchOutlookAssistRecipientGroup(groupName);
            store.save();
            this.renderOutlookAssist();
        },

        getOutlookAssistRecipientGroups() {
            const state = this.getOutlookAssistState();
            const groups = new Map();
            (state.recipientContacts || []).forEach(contact => {
                const contactGroups = normalizeOutlookAssistGroups(contact.groups || contact.group);
                (contactGroups.length ? contactGroups : [TXT.noGroup]).forEach(group => {
                    if (!groups.has(group)) groups.set(group, []);
                    groups.get(group).push(contact);
                });
            });
            return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        },

        getOutlookAssistAddressBookModalHtml() {
            if (!this._outlookAssistAddressBookOpen) return '';
            const state = this.getOutlookAssistState();
            const contacts = state.recipientContacts || [];
            const target = this._outlookAssistAddressBookTarget || 'to';
            const targetLabel = target === 'cc' ? 'CC' : (target === 'bcc' ? 'BCC' : TXT.to);
            const groups = this.getOutlookAssistRecipientGroups();
            const groupNames = groups.map(([group]) => group);
            const managingGroup = groupNames.includes(this._outlookAssistManagingGroup) ? this._outlookAssistManagingGroup : '';
            if (!managingGroup) this._outlookAssistManagingGroup = '';
            const addressQuery = String(this._outlookAssistAddressBookQuery || '');
            const addressQ = MaintenanceApp.toHalfWidthLower(addressQuery).trim();
            const visibleContacts = contacts.filter(contact => {
                if (!addressQ) return true;
                const groupsText = normalizeOutlookAssistGroups(contact.groups || contact.group).join(' ');
                const haystack = `${this.getOutlookAssistContactName(contact)} ${contact.email || ''} ${groupsText} ${contact.note || ''}`;
                return MaintenanceApp.toHalfWidthLower(haystack).includes(addressQ);
            });
            const groupMembers = managingGroup ? contacts.filter(contact => normalizeOutlookAssistGroups(contact.groups || contact.group).includes(managingGroup)) : [];
            const groupCandidates = managingGroup && managingGroup !== TXT.noGroup
                ? contacts.filter(contact => !normalizeOutlookAssistGroups(contact.groups || contact.group).includes(managingGroup))
                : [];
            const managingGroupColor = managingGroup ? this.getOutlookAssistGroupColor(managingGroup) : '';
            const groupManagerHtml = managingGroup ? `
                <section class="outlook-address-group-manager">
                    <div class="outlook-address-group-manager-head">
                        <div><b>${TXT.groupManage}: ${this.escapeHtml(managingGroup)}</b><small>${TXT.members}: ${groupMembers.length}</small></div>
                        ${managingGroup !== TXT.noGroup ? `<label class="outlook-address-group-color" title="${TXT.groupColor}"><i class="fa-solid fa-palette"></i><input type="color" value="${this.escapeHtml(managingGroupColor || '#e0f2fe')}" onchange="app.setOutlookAssistGroupColor('${this.escapeJs(managingGroup)}', this.value)"></label>` : ''}
                        ${managingGroup !== TXT.noGroup ? `<button type="button" class="secondary-btn" onclick="app.prepareOutlookAssistNewContactForGroup('${this.escapeJs(managingGroup)}')"><i class="fa-solid fa-user-plus"></i> このグループへ新規追加</button>` : ''}
                        ${managingGroup !== TXT.noGroup ? `<button type="button" class="secondary-btn danger" onclick="app.deleteOutlookAssistRecipientGroup('${this.escapeJs(managingGroup)}')"><i class="fa-solid fa-trash-can"></i> ${TXT.deleteGroup}</button>` : ''}
                    </div>
                    <div class="outlook-address-group-member-list">
                        <div class="outlook-address-group-member-column">
                            <h4>${TXT.members}</h4>
                            ${groupMembers.length ? groupMembers.map(contact => {
                                const note = String(contact.note || '').trim();
                                const noteClass = note.length > 28 ? ' x-small' : (note.length > 16 ? ' small' : '');
                                return `
                                    <div class="outlook-address-group-member">
                                        <span><b>${this.escapeHtml(this.getOutlookAssistContactName(contact))}</b><small class="outlook-address-member-email-row"><em>${this.escapeHtml(contact.email || TXT.emailRequired)}</em>${note ? `<strong class="outlook-address-note${noteClass}">${this.escapeHtml(note)}</strong>` : ''}</small></span>
                                        ${managingGroup !== TXT.noGroup ? `<button type="button" class="icon-btn danger" title="${TXT.removeFromGroup}" onclick="app.removeOutlookAssistContactFromGroup('${this.escapeJs(contact.id)}', '${this.escapeJs(managingGroup)}')"><i class="fa-solid fa-minus"></i></button>` : ''}
                                    </div>
                                `;
                            }).join('') : `<div class="outlook-template-empty">${TXT.emptyGroup}</div>`}
                        </div>
                        ${managingGroup !== TXT.noGroup ? `
                            <div class="outlook-address-group-member-column">
                                <h4>${TXT.notInGroup}</h4>
                                ${groupCandidates.length ? groupCandidates.map(contact => {
                                    const note = String(contact.note || '').trim();
                                    const noteClass = note.length > 28 ? ' x-small' : (note.length > 16 ? ' small' : '');
                                    return `
                                        <div class="outlook-address-group-member">
                                            <span><b>${this.escapeHtml(this.getOutlookAssistContactName(contact))}</b><small class="outlook-address-member-email-row"><em>${this.escapeHtml(contact.email || TXT.emailRequired)}</em>${note ? `<strong class="outlook-address-note${noteClass}">${this.escapeHtml(note)}</strong>` : ''}</small></span>
                                            <button type="button" class="icon-btn" title="${TXT.addToGroup}" onclick="app.addOutlookAssistContactToGroup('${this.escapeJs(contact.id)}', '${this.escapeJs(managingGroup)}')"><i class="fa-solid fa-plus"></i></button>
                                        </div>
                                    `;
                                }).join('') : `<div class="outlook-template-empty">${TXT.noContact}</div>`}
                            </div>
                        ` : ''}
                    </div>
                </section>
            ` : '';
            const editingContact = contacts.find(contact => contact.id === this._outlookAssistEditingRecipientContactId) || null;
            const newContactGroupValue = managingGroup && managingGroup !== TXT.noGroup ? managingGroup : '';
            return `
                <div class="outlook-address-modal-backdrop" onclick="app.closeOutlookAssistAddressBook()">
                    <section class="outlook-address-modal" onclick="event.stopPropagation()">
                        <div class="outlook-address-modal-head">
                            <div><h3><i class="fa-solid fa-address-book"></i> ${this._outlookAssistAddressBookMode === 'pick' ? TXT.addressSelect : TXT.addressBook}</h3><p>${TXT.addToTarget}: ${this.escapeHtml(targetLabel)}</p></div>
                            <button type="button" class="icon-btn outlook-address-close-btn" onclick="app.closeOutlookAssistAddressBook()"><i class="fa-solid fa-xmark"></i></button>
                        </div>
                        <div class="outlook-address-modal-body">
                            <form class="outlook-address-form" onsubmit="event.preventDefault(); app.saveOutlookAssistRecipientContact();">
                                <label class="outlook-address-field"><span>${TXT.familyName}</span><input id="outlook-address-family" placeholder="${TXT.familyName}" value="${this.escapeHtml(editingContact?.familyName || '')}"></label>
                                <label class="outlook-address-field"><span>${TXT.givenName}</span><input id="outlook-address-given" placeholder="${TXT.givenName}" value="${this.escapeHtml(editingContact?.givenName || '')}"></label>
                                <label class="outlook-address-field"><span>${TXT.email}</span><input id="outlook-address-email" placeholder="${TXT.email}" value="${this.escapeHtml(editingContact?.email || '')}"></label>
                                <label class="outlook-address-field"><span>${TXT.group}</span><input id="outlook-address-group" placeholder="${TXT.groupPlaceholder}" value="${this.escapeHtml(editingContact ? normalizeOutlookAssistGroups(editingContact.groups || editingContact.group).join(', ') : newContactGroupValue)}"></label>
                                <label class="outlook-address-field"><span>${TXT.note}</span><input id="outlook-address-note" placeholder="${TXT.note}" value="${this.escapeHtml(editingContact?.note || '')}"></label>
                                <button type="submit" class="primary-btn"><i class="fa-solid ${editingContact ? 'fa-floppy-disk' : 'fa-plus'}"></i> ${editingContact ? TXT.update : TXT.register}</button>
                                ${editingContact ? `<button type="button" class="secondary-btn" onclick="app.clearOutlookAssistRecipientContactEdit()"><i class="fa-solid fa-xmark"></i> ${TXT.cancelEdit}</button>` : ''}
                            </form>
                            <div class="outlook-address-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" placeholder="${TXT.addressSearch}" value="${this.escapeHtml(addressQuery)}" oninput="app.filterOutlookAssistAddressBook(this.value)"></div>
                            <div class="outlook-address-groups">
                                ${groups.length ? groups.map(([group, items]) => {
                                    const updated = state.recipientGroupUpdatedAt?.[group] || items.map(item => item.updatedAt).sort().at(-1) || '';
                                    const memberNames = items.map(contact => (contact.familyName || this.getOutlookAssistContactName(contact)).trim()).filter(Boolean);
                                    const visibleMemberNames = memberNames.slice(0, 8);
                                    const hiddenMemberCount = Math.max(0, memberNames.length - visibleMemberNames.length);
                                    const groupColor = this.getOutlookAssistGroupColor(group);
                                    const groupStyle = groupColor ? ` style="background:${this.escapeHtml(groupColor)}; border-color:${this.escapeHtml(groupColor)};"` : '';
                                    return `
                                        <div class="outlook-address-group ${group === managingGroup ? 'active' : ''} ${groupColor ? 'has-group-color' : ''}"${groupStyle}>
                                            <button type="button" class="outlook-address-group-main" onclick="app.openOutlookAssistGroupManager('${this.escapeJs(group)}')">
                                                <b>${this.escapeHtml(group)}</b><small>${TXT.lastUpdated}: ${this.escapeHtml(formatUpdatedAt(updated) || '-')}</small>
                                                <span class="outlook-address-group-members">
                                                    ${visibleMemberNames.map(name => `<em>${this.escapeHtml(name)}</em>`).join('')}
                                                    ${hiddenMemberCount ? `<em>+${hiddenMemberCount}</em>` : ''}
                                                </span>
                                            </button>
                                            <button type="button" class="secondary-btn" onclick="app.addOutlookAssistRecipientGroupToField('${this.escapeJs(group)}', '${this.escapeJs(target)}')"><i class="fa-solid fa-users"></i> ${TXT.addGroup}</button>
                                        </div>
                                    `;
                                }).join('') : `<div class="outlook-template-empty">${TXT.noContact}</div>`}
                            </div>
                            ${groupManagerHtml}
                            <div class="outlook-address-list">
                                ${visibleContacts.length ? visibleContacts.map(contact => {
                                    const note = String(contact.note || '').trim();
                                    const noteClass = note.length > 28 ? ' x-small' : (note.length > 16 ? ' small' : '');
                                    return `
                                        <div class="outlook-address-item">
                                            <div>
                                                <b>${this.escapeHtml(this.getOutlookAssistContactName(contact))}</b>
                                                <span class="outlook-address-email-row">
                                                    <em>${this.escapeHtml(contact.email || TXT.emailRequired)}</em>
                                                    ${note ? `<strong class="outlook-address-note${noteClass}">${this.escapeHtml(note)}</strong>` : ''}
                                                </span>
                                                <small>${this.escapeHtml((normalizeOutlookAssistGroups(contact.groups || contact.group).join(', ') || TXT.noGroup))}</small>
                                            </div>
                                            <div class="outlook-address-item-actions">
                                                <button type="button" class="secondary-btn" onclick="app.addOutlookAssistRecipientContactToField('${this.escapeJs(contact.id)}', '${this.escapeJs(target)}')"><i class="fa-solid fa-plus"></i> ${this.escapeHtml(targetLabel)}</button>
                                                <button type="button" class="icon-btn" title="${TXT.edit}" onclick="app.editOutlookAssistRecipientContact('${this.escapeJs(contact.id)}')"><i class="fa-solid fa-pen"></i></button>
                                                <button type="button" class="icon-btn danger" title="${TXT.delete}" onclick="app.deleteOutlookAssistRecipientContact('${this.escapeJs(contact.id)}')"><i class="fa-solid fa-trash-can"></i></button>
                                            </div>
                                        </div>
                                    `;
                                }).join('') : `<div class="outlook-template-empty">${contacts.length ? TXT.noContact : TXT.contactRequired}</div>`}
                            </div>
                        </div>
                    </section>
                </div>
            `;
        },

        getOutlookAssistTemplateUndoHtml() {
            const deleted = this._outlookAssistDeletedTemplate;
            if (!deleted) return '';
            return `<div class="outlook-template-undo"><span>${TXT.templateDeleted}</span><button type="button" onclick="app.undoDeleteOutlookAssistTemplate()">${TXT.undo}</button></div>`;
        },

        applyOutlookAssistVariables(text, overrides = {}) {
            let output = String(text ?? '');
            Object.entries(this.getOutlookAssistVariableMap(overrides)).forEach(([token, value]) => {
                output = output.split(token).join(value);
            });
            return output;
        },

        getOutlookAssistCategoryOptions(selected = 'request', includeAll = false) {
            const options = includeAll ? [{ id: 'all', label: TXT.categoryAll }, ...TEMPLATE_CATEGORIES] : TEMPLATE_CATEGORIES;
            return options.map(item => `<option value="${this.escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${this.escapeHtml(item.label)}</option>`).join('');
        },

        getOutlookAssistColorFilterOptions(selected = 'all') {
            const options = [
                { id: 'all', label: TXT.colorAll },
                { id: 'any', label: TXT.colorAny },
                { id: 'none', label: TXT.colorNone },
                ...TEMPLATE_COLOR_PRESETS.map(item => ({ id: item.id, label: item.label }))
            ];
            return options.map(item => `<option value="${this.escapeHtml(item.id)}" ${item.id === selected ? 'selected' : ''}>${this.escapeHtml(item.label)}</option>`).join('');
        },

        getOutlookAssistTemplateColorPresetId(color) {
            const normalized = normalizeOutlookAssistTemplateColor(color);
            return TEMPLATE_COLOR_PRESETS.find(item => item.color === normalized)?.id || '';
        },

        getOutlookAssistCoreWorkers() {
            const names = typeof this.getShiftNotebookPresetMemberNames === 'function' ? this.getShiftNotebookPresetMemberNames() : [];
            const types = this.ensureShiftNotebookMemberTypes?.() || {};
            return names.filter(name => types[name] !== 'support');
        },

        getOutlookAssistSelectableWorkers() {
            const workers = this.getOutlookAssistCoreWorkers();
            return workers.length ? workers : [TXT.guestWorker];
        },

        renderOutlookAssist() {
            const state = this.getOutlookAssistState();
            const workers = this.getOutlookAssistSelectableWorkers();
            if (!state.selectedWorker || !workers.includes(state.selectedWorker)) state.selectedWorker = workers[0] || '';
            this.renderOutlookAssistWorkers();
            this.renderOutlookAssistComposer();
        },

        renderOutlookAssistWorkers(query = document.getElementById('outlook-assist-worker-search')?.value || '') {
            const list = document.getElementById('outlook-assist-worker-list');
            if (!list) return;
            const state = this.getOutlookAssistState();
            const q = MaintenanceApp.toHalfWidthLower(query).trim();
            const coreWorkers = this.getOutlookAssistCoreWorkers();
            const workers = this.getOutlookAssistSelectableWorkers().filter(name => !q || MaintenanceApp.toHalfWidthLower(name).includes(q));
            if (!workers.length) {
                list.innerHTML = `<div class="outlook-assist-empty"><i class="fa-regular fa-address-card"></i><span>${TXT.noCore}</span><button type="button" class="secondary-btn" onclick="app.openShiftMemberTypeManageModal?.()">${TXT.openMemberManage}</button></div>`;
                return;
            }
            list.innerHTML = workers.map(name => {
                const pages = this.getOutlookAssistDraftPages(name);
                const pageIndex = this.getOutlookAssistDraftPageIndex(name);
                const draft = pages[pageIndex] || {};
                const active = state.selectedWorker === name;
                const updated = formatUpdatedAt(draft.updatedAt);
                const title = draft.pageTitle || draft.subject || TXT.noDraft;
                const pageCount = pages.length > 1 ? `${TXT.draftPageCount}${pages.length}\u4ef6 ${pageIndex + 1}/${pages.length}` : '';
                const guestNote = !coreWorkers.length ? `<small>${TXT.guestWorkerNote}</small>` : '';
                const pageColor = normalizeOutlookAssistTemplateColor(draft.pageColor || '');
                return `<button type="button" class="outlook-assist-worker ${active ? 'active' : ''}" style="${pageColor ? `--page-color:${this.escapeHtml(pageColor)}` : ''}" onclick="app.selectOutlookAssistWorker('${this.escapeJs(name)}')"><span>${pageColor ? '<i class="outlook-page-color-dot"></i>' : ''}${this.escapeHtml(name)}</span>${guestNote}<small>${this.escapeHtml(title)}</small>${pageCount ? `<small>${this.escapeHtml(pageCount)}</small>` : ''}${updated ? `<em>${this.escapeHtml(updated)}</em>` : ''}</button>`;
            }).join('');
        },

        filterOutlookAssistWorkers(query) {
            this.renderOutlookAssistWorkers(query);
        },

        selectOutlookAssistWorker(name) {
            const state = this.getOutlookAssistState();
            state.selectedWorker = String(name || '').trim();
            this.getOutlookAssistDraftPages(state.selectedWorker);
            store.save();
            this.renderOutlookAssist();
        },

        getOutlookAssistDraftPages(worker = this.getOutlookAssistState().selectedWorker || '') {
            const state = this.getOutlookAssistState();
            const key = String(worker || '').trim();
            if (!key) return [createEmptyDraft()];
            let pages = state.draftPagesByWorker[key];
            if (!Array.isArray(pages) || !pages.length) {
                pages = [normalizeOutlookAssistDraftRecord(state.draftsByWorker[key] || createEmptyDraft())];
            } else {
                pages = pages.map(page => normalizeOutlookAssistDraftRecord(page));
            }
            state.draftPagesByWorker[key] = pages;
            let index = Number(state.draftPageIndexByWorker[key]);
            if (!Number.isFinite(index)) index = 0;
            index = Math.max(0, Math.min(pages.length - 1, Math.floor(index)));
            state.draftPageIndexByWorker[key] = index;
            state.draftsByWorker[key] = pages[index];
            return pages;
        },

        getOutlookAssistDraftPageIndex(worker = this.getOutlookAssistState().selectedWorker || '') {
            const state = this.getOutlookAssistState();
            this.getOutlookAssistDraftPages(worker);
            return Math.max(0, Number(state.draftPageIndexByWorker[String(worker || '').trim()]) || 0);
        },

        setCurrentOutlookAssistDraft(nextDraft) {
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return null;
            const pages = this.getOutlookAssistDraftPages(worker);
            const index = this.getOutlookAssistDraftPageIndex(worker);
            const record = normalizeOutlookAssistDraftRecord({
                ...nextDraft,
                updatedAt: nextDraft?.updatedAt || new Date().toISOString()
            });
            pages[index] = record;
            state.draftPagesByWorker[worker] = pages;
            state.draftsByWorker[worker] = record;
            return record;
        },

        isOutlookAssistDraftBlank(draft = {}) {
            return ['to', 'cc', 'bcc', 'subject', 'body', 'machineName', 'pageTitle']
                .every(field => !String(draft[field] || '').trim());
        },

        getUniqueOutlookAssistDraftPageTitle(baseTitle, pages = []) {
            const base = String(baseTitle || '').replace(/\s+\u30b3\u30d4\u30fc\d*$/u, '').trim();
            if (!base) return '';
            const used = new Set((pages || []).map(page => String(page?.pageTitle || '').trim()).filter(Boolean));
            let candidate = `${base} \u30b3\u30d4\u30fc`;
            let index = 2;
            while (used.has(candidate)) {
                candidate = `${base} \u30b3\u30d4\u30fc${index}`;
                index += 1;
            }
            return candidate;
        },

        getUniqueOutlookAssistDraftPageTitleExact(baseTitle, pages = []) {
            const base = String(baseTitle || '').trim();
            if (!base) return '';
            const used = new Set((pages || []).map(page => String(page?.pageTitle || '').trim()).filter(Boolean));
            if (!used.has(base)) return base;
            let index = 2;
            let candidate = `${base}${index}`;
            while (used.has(candidate)) {
                index += 1;
                candidate = `${base}${index}`;
            }
            return candidate;
        },

        toggleOutlookAssistDraftPageList() {
            this._outlookAssistShowDraftPageList = !this._outlookAssistShowDraftPageList;
            this.renderOutlookAssistComposer();
        },

        closeOutlookAssistDraftPageList() {
            if (!this._outlookAssistShowDraftPageList) return;
            this._outlookAssistShowDraftPageList = false;
            this.renderOutlookAssistComposer();
        },

        jumpOutlookAssistDraftPage(index) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            const nextIndex = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
            const changed = nextIndex !== this.getOutlookAssistDraftPageIndex(worker);
            state.draftPageIndexByWorker[worker] = nextIndex;
            state.draftsByWorker[worker] = pages[nextIndex] || createEmptyDraft();
            this._outlookAssistShowDraftPageList = false;
            store.save();
            this.renderOutlookAssist();
            if (changed) this.showOutlookAssistDraftPageSwitchNotice();
        },

        showOutlookAssistDraftPageSwitchNotice() {
            document.getElementById('outlook-draft-page-switch-notice')?.remove();
            if (this._outlookDraftPageSwitchNoticeTimer) clearTimeout(this._outlookDraftPageSwitchNoticeTimer);
            const notice = document.createElement('div');
            notice.id = 'outlook-draft-page-switch-notice';
            notice.className = 'outlook-draft-page-switch-notice';
            notice.innerHTML = '<i class="fa-solid fa-layer-group"></i><span>下書きページを切り替えました</span>';
            document.body.appendChild(notice);
            requestAnimationFrame(() => notice.classList.add('show'));
            this._outlookDraftPageSwitchNoticeTimer = setTimeout(() => {
                notice.classList.remove('show');
                setTimeout(() => notice.remove(), 260);
            }, 3000);
        },

        getOutlookAssistDraftPageListHtml(pages, currentIndex) {
            if (!this._outlookAssistShowDraftPageList) return '';
            return `<div class="outlook-draft-page-list-backdrop" onclick="app.closeOutlookAssistDraftPageList()"></div><div class="outlook-draft-page-list" onclick="event.stopPropagation()">${(pages || []).map((page, index) => {
                const title = page.pageTitle || page.subject || TXT.noDraft;
                const body = normalizePlainText(page.body || '').slice(0, 34);
                const pageColor = normalizeOutlookAssistTemplateColor(page.pageColor || '');
                return `<div class="outlook-draft-page-list-row ${index === currentIndex ? 'active' : ''}" style="${pageColor ? `--page-color:${this.escapeHtml(pageColor)}` : ''}">
                    <button type="button" class="outlook-draft-page-list-main" onclick="app.jumpOutlookAssistDraftPage(${index})"><i class="outlook-draft-page-list-dot"></i><span><b>${index + 1}. ${this.escapeHtml(title)}</b>${body ? `<small>${this.escapeHtml(body)}</small>` : ''}</span></button>
                    <div class="outlook-draft-page-list-actions">
                        <label title="${TXT.pageColor}" class="outlook-draft-page-list-color" style="${pageColor ? `--page-color:${this.escapeHtml(pageColor)}` : ''}"><i class="fa-solid fa-palette"></i><input type="color" value="${this.escapeHtml(pageColor || '#ffffff')}" oninput="app.setOutlookAssistDraftPageColor(${index}, this.value)"></label>
                        ${this.getOutlookAssistDraftPageColorPresetHtml(index, pageColor)}
                        <button type="button" title="${TXT.movePageUp}" onclick="app.moveOutlookAssistDraftPage(${index}, -1)" ${index <= 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                        <button type="button" title="${TXT.movePageDown}" onclick="app.moveOutlookAssistDraftPage(${index}, 1)" ${index >= pages.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                        <button type="button" title="${TXT.duplicateDraftPage}" onclick="app.duplicateOutlookAssistDraftPage(${index})"><i class="fa-regular fa-copy"></i></button>
                        <button type="button" title="${TXT.deleteDraftPage}" onclick="app.deleteOutlookAssistDraftPage(${index})" ${pages.length <= 1 ? 'disabled' : ''}><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>`;
            }).join('')}</div>`;
        },

        getOutlookAssistDraftPageColorPresetHtml(index = null, selectedColor = '') {
            const normalizedSelectedColor = normalizeOutlookAssistTemplateColor(selectedColor || '');
            return `<div class="outlook-page-color-presets">${DRAFT_PAGE_COLOR_PRESETS.map(item => {
                const isSelected = item.color ? item.color === normalizedSelectedColor : !normalizedSelectedColor;
                const style = item.color ? `--preset-color:${this.escapeHtml(item.color)}` : '';
                const onclick = index === null
                    ? `app.setOutlookAssistCurrentDraftPageColor('${this.escapeJs(item.color || '')}')`
                    : `app.setOutlookAssistDraftPageColor(${index}, '${this.escapeJs(item.color || '')}')`;
                return `<button type="button" class="${isSelected ? 'selected' : ''}" title="${this.escapeHtml(item.label)}" style="${style}" onclick="${onclick}">${isSelected ? '<i class="fa-solid fa-check"></i>' : ''}</button>`;
            }).join('')}</div>`;
        },

        setOutlookAssistCurrentDraftPageColor(color) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            this.setOutlookAssistDraftPageColor(this.getOutlookAssistDraftPageIndex(worker), color);
        },

        setOutlookAssistDraftPageColor(index, color) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            const targetIndex = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
            const pageColor = normalizeOutlookAssistTemplateColor(color || '');
            pages[targetIndex] = {
                ...normalizeOutlookAssistDraftRecord(pages[targetIndex] || createEmptyDraft()),
                pageColor: pageColor === '#ffffff' ? '' : pageColor,
                updatedAt: new Date().toISOString()
            };
            state.draftPagesByWorker[worker] = pages;
            state.draftsByWorker[worker] = pages[this.getOutlookAssistDraftPageIndex(worker)] || pages[0] || createEmptyDraft();
            store.save();
            this.renderOutlookAssistComposer();
            this.renderOutlookAssistWorkers();
        },

        moveOutlookAssistDraftPage(index, direction) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            const from = Math.max(0, Math.min(pages.length - 1, Number(index) || 0));
            const to = from + (direction < 0 ? -1 : 1);
            if (to < 0 || to >= pages.length) return;
            const [page] = pages.splice(from, 1);
            pages.splice(to, 0, page);
            const current = this.getOutlookAssistDraftPageIndex(worker);
            let nextCurrent = current;
            if (current === from) nextCurrent = to;
            else if (from < current && to >= current) nextCurrent = current - 1;
            else if (from > current && to <= current) nextCurrent = current + 1;
            state.draftPagesByWorker[worker] = pages;
            state.draftPageIndexByWorker[worker] = nextCurrent;
            state.draftsByWorker[worker] = pages[nextCurrent] || createEmptyDraft();
            store.save();
            this.renderOutlookAssist();
        },

        switchOutlookAssistDraftPage(direction) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            let index = Math.max(0, Math.min(pages.length - 1, Number(state.draftPageIndexByWorker[worker]) || 0));
            const previousIndex = index;
            if (direction > 0) {
                if (index >= pages.length - 1) pages.push(createEmptyDraft());
                index += 1;
            } else {
                index = Math.max(0, index - 1);
            }
            state.draftPagesByWorker[worker] = pages;
            state.draftPageIndexByWorker[worker] = Math.max(0, Math.min(pages.length - 1, index));
            state.draftsByWorker[worker] = pages[state.draftPageIndexByWorker[worker]];
            store.save();
            this.renderOutlookAssist();
            if (state.draftPageIndexByWorker[worker] !== previousIndex) this.showOutlookAssistDraftPageSwitchNotice();
        },

        deleteOutlookAssistDraftPage(targetIndex = null) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            if (pages.length <= 1) return;
            if (!confirm(TXT.draftPageDeleteAsk)) return;
            const currentIndex = Math.max(0, Math.min(pages.length - 1, Number(state.draftPageIndexByWorker[worker]) || 0));
            const index = targetIndex === null ? currentIndex : Math.max(0, Math.min(pages.length - 1, Number(targetIndex) || 0));
            pages.splice(index, 1);
            let nextIndex = currentIndex;
            if (index === currentIndex) nextIndex = Math.max(0, Math.min(pages.length - 1, index - 1));
            else if (index < currentIndex) nextIndex = Math.max(0, currentIndex - 1);
            nextIndex = Math.max(0, Math.min(pages.length - 1, nextIndex));
            state.draftPagesByWorker[worker] = pages;
            state.draftPageIndexByWorker[worker] = nextIndex;
            state.draftsByWorker[worker] = pages[nextIndex] || createEmptyDraft();
            store.save();
            this.renderOutlookAssist();
        },

        duplicateOutlookAssistDraftPage(targetIndex = null) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return;
            const pages = this.getOutlookAssistDraftPages(worker);
            const index = targetIndex === null
                ? Math.max(0, Math.min(pages.length - 1, Number(state.draftPageIndexByWorker[worker]) || 0))
                : Math.max(0, Math.min(pages.length - 1, Number(targetIndex) || 0));
            const current = normalizeOutlookAssistDraftRecord(pages[index] || this.getCurrentOutlookAssistDraft());
            const baseTitle = current.pageTitle || current.subject || '';
            const copied = normalizeOutlookAssistDraftRecord({
                ...current,
                pageTitle: this.getUniqueOutlookAssistDraftPageTitle(baseTitle, pages),
                updatedAt: new Date().toISOString()
            });
            pages.splice(index + 1, 0, copied);
            state.draftPagesByWorker[worker] = pages;
            state.draftPageIndexByWorker[worker] = index + 1;
            state.draftsByWorker[worker] = copied;
            store.save();
            this.renderOutlookAssist();
        },

        getCurrentOutlookAssistDraft() {
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return createEmptyDraft();
            const pages = this.getOutlookAssistDraftPages(worker);
            const draft = pages[this.getOutlookAssistDraftPageIndex(worker)] || createEmptyDraft();
            if (!draft.wrapAt) draft.wrapAt = DEFAULT_WRAP_AT;
            if (typeof draft.autoWrap !== 'boolean') draft.autoWrap = true;
            if (typeof draft.machineName !== 'string') draft.machineName = '';
            if (typeof draft.insertLabel !== 'string') draft.insertLabel = TXT.machine;
            return draft;
        },

        markOutlookAssistPageTitleLocked() {
            const checkbox = document.getElementById('outlook-assist-page-title-lock');
            if (checkbox) checkbox.checked = true;
        },

        renderOutlookAssistComposer() {
            const container = document.getElementById('outlook-assist-main');
            if (!container) return;
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) {
                container.innerHTML = `<div class="outlook-assist-start"><i class="fa-regular fa-envelope-open"></i><h3>${TXT.selectCoreTitle}</h3><p>${TXT.selectCoreBody}</p></div>`;
                return;
            }
            const draft = this.getCurrentOutlookAssistDraft();
            const insertLabel = this.escapeHtml(this.getOutlookAssistInsertLabel());
            const editingTemplate = this.getOutlookAssistEditingTemplate();
            const editingTitle = editingTemplate?.title || '';
            const templateFormTitle = editingTemplate ? editingTitle : '';
            const templateFormInsertLabel = editingTemplate ? (editingTemplate.insertLabel || TXT.machine) : this.getOutlookAssistInsertLabel();
            const templateFormCategory = editingTemplate ? this.getOutlookAssistTemplateCategoryId(editingTemplate.category || 'other') : 'request';
            const bodyTopCollapsed = !!state.bodyTopCollapsed;
            const draftPages = this.getOutlookAssistDraftPages(worker);
            const draftPageIndex = this.getOutlookAssistDraftPageIndex(worker);
            const draftPageColor = normalizeOutlookAssistTemplateColor(draft.pageColor || '');
            const pageControlsDisabled = editingTemplate ? 'disabled' : '';
            const pageControlsTitle = editingTemplate ? '\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u7de8\u96c6\u4e2d\u306f\u4e0b\u66f8\u304d\u30da\u30fc\u30b8\u3092\u5207\u308a\u66ff\u3048\u3067\u304d\u307e\u305b\u3093' : '';
            container.innerHTML = `
                <div class="outlook-compose-card ${bodyTopCollapsed ? 'body-focus' : ''} ${editingTemplate ? 'template-editing' : ''}">
                    <div class="outlook-compose-top">
                        <div class="outlook-compose-title-area">
                            <div class="outlook-compose-worker-name">${this.escapeHtml(worker)}</div>
                        </div>
                        <div class="outlook-compose-actions">
                            <div class="outlook-draft-page-switcher" style="${draftPageColor ? `--page-color:${this.escapeHtml(draftPageColor)}` : ''}">
                                <button type="button" class="secondary-btn" title="${pageControlsTitle}" onclick="app.switchOutlookAssistDraftPage(-1)" ${pageControlsDisabled || (draftPageIndex <= 0 ? 'disabled' : '')}>&#9664;</button>
                                <button type="button" class="outlook-draft-page-count" title="${pageControlsTitle || TXT.pageList}" onclick="app.toggleOutlookAssistDraftPageList()" ${pageControlsDisabled}>${draftPageIndex + 1}/${draftPages.length}</button>
                                <button type="button" class="secondary-btn" title="${pageControlsTitle}" onclick="app.switchOutlookAssistDraftPage(1)" ${pageControlsDisabled}>&#9654;</button>
                                <input id="outlook-assist-page-title" value="${this.escapeHtml(draft.pageTitle || '')}" placeholder="${TXT.pageName}" oninput="app.markOutlookAssistPageTitleLocked(); app.saveOutlookAssistDraftFromForm()" ${pageControlsDisabled}>
                                <label class="outlook-page-color-picker ${editingTemplate ? 'disabled' : ''}" title="${pageControlsTitle || TXT.pageColor}" style="${draftPageColor ? `--page-color:${this.escapeHtml(draftPageColor)}` : ''}"><i class="fa-solid fa-palette"></i><input id="outlook-assist-page-color" type="color" value="${this.escapeHtml(draftPageColor || '#ffffff')}" oninput="app.saveOutlookAssistDraftFromForm(); app.renderOutlookAssistWorkers()" ${pageControlsDisabled}></label>
                                ${editingTemplate ? '' : this.getOutlookAssistDraftPageColorPresetHtml(null, draftPageColor)}
                                <label class="outlook-page-title-lock"><input id="outlook-assist-page-title-lock" type="checkbox" ${draft.pageTitleLocked ? 'checked' : ''} onchange="app.saveOutlookAssistDraftFromForm()" ${pageControlsDisabled}> ${TXT.pageTitleLock}</label>
                                <button type="button" class="secondary-btn" title="${pageControlsTitle || TXT.duplicateDraftPage}" onclick="app.duplicateOutlookAssistDraftPage()" ${pageControlsDisabled}><i class="fa-regular fa-copy"></i></button>
                                <button type="button" class="secondary-btn outlook-draft-page-delete" title="${pageControlsTitle || TXT.deleteDraftPage}" onclick="app.deleteOutlookAssistDraftPage()" ${pageControlsDisabled || (draftPages.length <= 1 ? 'disabled' : '')}><i class="fa-solid fa-trash-can"></i></button>
                                ${this.getOutlookAssistDraftPageListHtml(draftPages, draftPageIndex)}
                            </div>
                            <button type="button" class="secondary-btn" onclick="app.openOutlookAssistAddressBook('manage')"><i class="fa-solid fa-address-book"></i> ${TXT.addressBook}</button>
                            ${editingTemplate ? `<div class="outlook-template-edit-top-indicator"><span><i class="fa-solid fa-pen-to-square"></i> \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u7de8\u96c6\u753b\u9762: ${this.escapeHtml(editingTitle || TXT.unnamed)}</span><button type="button" class="save" onclick="app.saveOutlookAssistTemplate('overwrite')"><i class="fa-solid fa-floppy-disk"></i> \u4e0a\u66f8\u304d</button><button type="button" onclick="app.saveOutlookAssistTemplate('copy')"><i class="fa-regular fa-copy"></i> \u5225\u540d</button><button type="button" onclick="app.clearOutlookAssistTemplateEditMode()"><i class="fa-solid fa-arrow-left"></i> \u4e0b\u66f8\u304d\u306b\u623b\u308b</button></div>` : ''}
                            <button type="button" class="secondary-btn" onclick="app.exportOutlookAssistPersonalData()"><i class="fa-solid fa-file-export"></i> ${TXT.exportPersonal}</button>
                            <button type="button" class="secondary-btn" onclick="document.getElementById('outlook-personal-import-file')?.click()"><i class="fa-solid fa-file-import"></i> ${TXT.importPersonal}</button>
                            <input id="outlook-personal-import-file" type="file" accept="application/json,.json" hidden onchange="app.importOutlookAssistPersonalDataFromFile(this.files?.[0]); this.value = '';">
                            <button type="button" class="secondary-btn" onclick="app.clearOutlookAssistDraft()"><i class="fa-solid fa-eraser"></i> ${TXT.clear}</button>
                            <button type="button" class="primary-btn outlook-copy-btn" onclick="app.copyOutlookAssistAll()"><i class="fa-regular fa-copy"></i> ${TXT.copyAll}</button>
                        </div>
                    </div>
                    <div class="outlook-personal-io-options">
                        <span>${TXT.exportPersonal}</span>
                        <label><input type="checkbox" id="outlook-export-draft" ${state.personalExportOptions.draft ? 'checked' : ''} onchange="app.setOutlookAssistPersonalExportOption('draft', this.checked)"> ${TXT.exportDraft}</label>
                        <label><input type="checkbox" id="outlook-export-copy-status" ${state.personalExportOptions.copyStatus ? 'checked' : ''} onchange="app.setOutlookAssistPersonalExportOption('copyStatus', this.checked)"> ${TXT.exportCopyStatus}</label>
                        <label><input type="checkbox" id="outlook-export-templates" ${state.personalExportOptions.templates ? 'checked' : ''} onchange="app.setOutlookAssistPersonalExportOption('templates', this.checked)"> ${TXT.exportTemplates}</label>
                        <label><input type="checkbox" id="outlook-export-address-book" ${state.personalExportOptions.addressBook ? 'checked' : ''} onchange="app.setOutlookAssistPersonalExportOption('addressBook', this.checked)"> ${TXT.exportAddressBook}</label>
                    </div>
                    <div class="outlook-mail-window">
                        <div class="outlook-body-top-fold">
                            ${this.getOutlookAssistRecipientDatalistHtml()}
                            <label class="outlook-recipient-field"><span>${TXT.to}</span><div class="outlook-recipient-entry">${this.getOutlookAssistRecipientChipsHtml('to', draft.to)}<input id="outlook-assist-to" list="outlook-recipient-candidates" value="${this.splitOutlookAssistRecipients(draft.to).length ? '' : this.escapeHtml(this.getOutlookAssistRecipientDisplay(draft.to))}" onfocus="app.focusOutlookAssistRecipientField('to')" onblur="app.blurOutlookAssistRecipientField('to')" oninput="app.onOutlookAssistRecipientInput('to')"></div><button type="button" class="outlook-recipient-picker-btn" onclick="app.openOutlookAssistAddressBook('pick', 'to')">${TXT.select}</button></label>
                            <label class="outlook-recipient-field"><span>CC</span><div class="outlook-recipient-entry">${this.getOutlookAssistRecipientChipsHtml('cc', draft.cc)}<input id="outlook-assist-cc" list="outlook-recipient-candidates" value="${this.splitOutlookAssistRecipients(draft.cc).length ? '' : this.escapeHtml(this.getOutlookAssistRecipientDisplay(draft.cc))}" onfocus="app.focusOutlookAssistRecipientField('cc')" onblur="app.blurOutlookAssistRecipientField('cc')" oninput="app.onOutlookAssistRecipientInput('cc')"></div><button type="button" class="outlook-recipient-picker-btn" onclick="app.openOutlookAssistAddressBook('pick', 'cc')">${TXT.select}</button></label>
                            <label class="outlook-recipient-field"><span>BCC</span><div class="outlook-recipient-entry">${this.getOutlookAssistRecipientChipsHtml('bcc', draft.bcc)}<input id="outlook-assist-bcc" list="outlook-recipient-candidates" value="${this.splitOutlookAssistRecipients(draft.bcc).length ? '' : this.escapeHtml(this.getOutlookAssistRecipientDisplay(draft.bcc))}" onfocus="app.focusOutlookAssistRecipientField('bcc')" onblur="app.blurOutlookAssistRecipientField('bcc')" oninput="app.onOutlookAssistRecipientInput('bcc')"></div><button type="button" class="outlook-recipient-picker-btn" onclick="app.openOutlookAssistAddressBook('pick', 'bcc')">${TXT.select}</button></label>
                            <div class="outlook-recipient-delimiter-help"><i class="fa-solid fa-circle-info"></i>${TXT.recipientDelimiterHelp}</div>
                            <label><span>${TXT.subject}</span><input id="outlook-assist-subject" value="${this.escapeHtml(draft.subject)}" oninput="app.saveOutlookAssistDraftFromForm()"></label>
                            <div class="outlook-subject-variable-bar">
                                <span>${TXT.subjectInsert}</span>
                                <button type="button" onclick="app.insertOutlookAssistVariableToField('subject', '${TXT.varDate}')">${TXT.varDate}</button>
                                <button type="button" onclick="app.insertOutlookAssistVariableToField('subject', '${TXT.varMachine}')">${TXT.varMachine}</button>
                            </div>
                            ${this.getOutlookAssistSubjectPresetsHtml()}
                            <label><span>${insertLabel}</span><input id="outlook-assist-machine" value="${this.escapeHtml(draft.machineName || '')}" oninput="app.saveOutlookAssistDraftFromForm()"></label>
                        </div>
                        <div class="outlook-body-toolbar">
                            <button type="button" class="secondary-btn outlook-body-focus-toggle ${bodyTopCollapsed ? 'active' : ''}" onclick="app.toggleOutlookAssistBodyTop()"><i class="fa-solid ${bodyTopCollapsed ? 'fa-compress' : 'fa-expand'}"></i> ${bodyTopCollapsed ? TXT.expandBodyTop : TXT.collapseBodyTop}</button>
                            <button type="button" id="outlook-body-undo-btn" class="secondary-btn" onclick="app.undoOutlookAssistBody()" disabled><i class="fa-solid fa-rotate-left"></i> ${TXT.undoBody}</button>
                            <button type="button" id="outlook-body-redo-btn" class="secondary-btn" onclick="app.redoOutlookAssistBody()" disabled><i class="fa-solid fa-rotate-right"></i> ${TXT.redoBody}</button>
                            <label class="outlook-wrap-control"><i class="fa-solid fa-align-left"></i><span>${TXT.autoWrap}</span><input id="outlook-assist-auto-wrap" type="checkbox" ${draft.autoWrap ? 'checked' : ''} onchange="app.saveOutlookAssistDraftFromForm(); app.applyOutlookAssistWrap()"></label>
                            <label class="outlook-wrap-control outlook-merge-wrap-control ${draft.mergeWrap ? 'active' : ''}" title="${TXT.mergeWrapHelp}"><i class="fa-solid fa-link"></i><span>${TXT.mergeWrap}</span><input id="outlook-assist-merge-wrap" type="checkbox" ${draft.mergeWrap ? 'checked' : ''} onchange="app.toggleOutlookAssistMergeWrap(this.checked)"></label>
                            <label class="outlook-wrap-control"><span>${TXT.chars}</span><input id="outlook-assist-wrap-at" type="number" min="10" max="120" value="${this.escapeHtml(draft.wrapAt)}" oninput="app.saveOutlookAssistDraftFromForm(); app.applyOutlookAssistWrap()"></label>
                            <button type="button" class="secondary-btn" onclick="app.applyOutlookAssistWrap(true)"><i class="fa-solid fa-align-left"></i> ${TXT.wrapNow}</button>
                            <button type="button" class="secondary-btn" onclick="app.unwrapOutlookAssistBody()"><i class="fa-solid fa-arrow-rotate-left"></i> ${TXT.unwrapNow}</button>
                            <button type="button" class="secondary-btn" onclick="app.removeOutlookAssistBlankLines()"><i class="fa-solid fa-compress-lines"></i> ${TXT.removeBlankLines}</button>
                            <button type="button" class="secondary-btn outlook-copy-btn" onclick="app.copyOutlookAssistField('to')"><i class="fa-regular fa-copy"></i> ${TXT.copyTo}</button>
                            <button type="button" class="secondary-btn outlook-copy-btn" onclick="app.copyOutlookAssistField('cc')"><i class="fa-regular fa-copy"></i> ${TXT.copyCc}</button>
                            <button type="button" class="secondary-btn outlook-copy-btn" onclick="app.copyOutlookAssistField('bcc')"><i class="fa-regular fa-copy"></i> ${TXT.copyBcc}</button>
                            <button type="button" class="secondary-btn outlook-copy-btn" onclick="app.copyOutlookAssistField('subject')"><i class="fa-regular fa-copy"></i> ${TXT.copySubject}</button>
                            <button type="button" class="secondary-btn outlook-copy-btn" onclick="app.copyOutlookAssistField('body')"><i class="fa-regular fa-copy"></i> ${TXT.copyBody}</button>
                        </div>
                        ${this.getOutlookAssistRecipientCheckHtml(draft)}
                        <div class="outlook-variable-bar">
                            <span>${TXT.insertVars}</span>
                            <button type="button" onclick="app.insertOutlookAssistVariable('${TXT.varDate}')">${TXT.varDate}</button>
                            <button type="button" onclick="app.insertOutlookAssistVariable('${TXT.varMachine}')">${TXT.varMachine}</button>
                        </div>
                        ${this.getOutlookAssistQuickPhrasesHtml()}
                        <textarea id="outlook-assist-body" class="outlook-body-input" placeholder="${TXT.bodyPlaceholder}" onkeydown="app.handleOutlookAssistBodyKeydown(event)" oncompositionstart="this.dataset.composing = 'true'" oncompositionend="this.dataset.composing = 'false'; app.onOutlookAssistBodyInput(event)" oninput="app.onOutlookAssistBodyInput(event)" onpaste="app.pastePlainTextIntoOutlookBody(event)">${this.escapeHtml(draft.body)}</textarea>
                        <div id="outlook-assist-warning" class="outlook-assist-warning" hidden></div>
                        ${this.getOutlookAssistTemplateDiffHtml()}
                        <div class="outlook-copy-preview">
                            <div><i class="fa-regular fa-eye"></i> ${TXT.previewTitle}</div>
                            <pre id="outlook-copy-preview-text"></pre>
                        </div>
                    </div>
                </div>
                <aside class="outlook-template-panel">
                    <div class="outlook-template-head">
                        <div><h3><i class="fa-solid fa-address-book"></i> ${TXT.recipientSets}</h3><p>${TXT.apply}</p></div>
                    </div>
                    ${this.getOutlookAssistRecipientSetsHtml()}
                    <div class="outlook-template-head">
                        <div><h3><i class="fa-solid fa-layer-group"></i> ${TXT.templates}</h3><p>${TXT.searchApply}</p></div>
                        ${editingTemplate ? `
                            <div class="outlook-template-edit-actions">
                                <button type="button" class="primary-btn" onclick="app.saveOutlookAssistTemplate('overwrite')"><i class="fa-solid fa-floppy-disk"></i> ${TXT.overwriteSave}</button>
                                <button type="button" class="secondary-btn" onclick="app.saveOutlookAssistTemplate('copy')"><i class="fa-regular fa-copy"></i> ${TXT.saveAsTemplate}</button>
                                <button type="button" class="secondary-btn" onclick="app.clearOutlookAssistTemplateEditMode()"><i class="fa-solid fa-xmark"></i> ${TXT.cancelEdit}</button>
                            </div>
                        ` : `<button type="button" class="primary-btn" onclick="app.saveOutlookAssistTemplate()"><i class="fa-solid fa-floppy-disk"></i> ${TXT.register}</button>`}
                    </div>
                    ${editingTemplate ? `<div class="outlook-template-edit-banner"><i class="fa-solid fa-pen-to-square"></i><span>${TXT.editingTemplate}: ${this.escapeHtml(editingTitle || TXT.unnamed)}</span></div>` : ''}
                    <div class="outlook-template-form">
                        <input id="outlook-template-title" class="outlook-template-title-input" placeholder="${TXT.templateTitle}" value="${this.escapeHtml(templateFormTitle)}" oninput="app.renderOutlookAssistTemplateTitleWarning()">
                        <input id="outlook-template-insert-label" class="outlook-template-title-input" placeholder="${TXT.insert1Label}" value="${this.escapeHtml(templateFormInsertLabel)}">
                        <select id="outlook-template-category">${this.getOutlookAssistCategoryOptions(templateFormCategory)}</select>
                    </div>
                    <div id="outlook-template-title-warning">${this.getOutlookAssistTemplateTitleWarningHtml()}</div>
                    <div class="outlook-template-filter">
                        <select id="outlook-template-filter-category" onchange="app.renderOutlookAssistTemplates()">${this.getOutlookAssistCategoryOptions(state.templateFilterCategory || 'all', true)}</select>
                        <select id="outlook-template-filter-color" onchange="app.renderOutlookAssistTemplates()">${this.getOutlookAssistColorFilterOptions(state.templateFilterColor || 'all')}</select>
                        <select id="outlook-template-sort-mode" onchange="app.renderOutlookAssistTemplates()">${this.getOutlookAssistTemplateSortOptions(state.templateSortMode || 'manual')}</select>
                        <button type="button" class="secondary-btn outlook-template-color-toggle ${state.showTemplateColorPresets ? 'active' : ''}" onclick="app.toggleOutlookAssistTemplateColorPresets()"><i class="fa-solid fa-palette"></i> ${TXT.colorPresets}</button>
                        <button type="button" class="secondary-btn outlook-template-compact-toggle ${state.compactTemplateCards ? 'active' : ''}" onclick="app.toggleOutlookAssistTemplateCompact()"><i class="fa-solid fa-compress"></i> ${TXT.compactCards}</button>
                    </div>
                    <div class="outlook-assist-search"><i class="fa-solid fa-magnifying-glass"></i><input type="search" id="outlook-template-search" placeholder="${TXT.templateSearch}" oninput="app.renderOutlookAssistTemplates()"></div>
                    <div id="outlook-template-list" class="outlook-template-list">${this.getOutlookAssistTemplateListHtml(state.templates, '', state.templateFilterCategory || 'all', state.templateFilterColor || 'all', state.showTemplateColorPresets, state.compactTemplateCards)}${this.getOutlookAssistTemplateUndoHtml()}</div>
                </aside>
                ${this.getOutlookAssistAddressBookModalHtml()}
            `;
            this.attachOutlookAssistPlainPasteHandlers();
            this.syncOutlookAssistBodyHistory(draft.body || '');
            this.updateOutlookAssistBodyHistoryButtons();
            this.renderOutlookAssistPreview();
        },

        getOutlookAssistTemplateListHtml(templates, query = '', category = 'all', colorFilter = 'all', showColorPresets = false, compactCards = false) {
            const q = MaintenanceApp.toHalfWidthLower(query).trim();
            const filtered = this.sortOutlookAssistTemplates(templates || [])
                .filter(t => category === 'all' || this.getOutlookAssistTemplateCategoryId(t.category || 'other') === category)
                .filter(t => {
                    const cardColor = normalizeOutlookAssistTemplateColor(t.cardColor);
                    if (colorFilter === 'any') return !!cardColor;
                    if (colorFilter === 'none') return !cardColor;
                    if (colorFilter === 'all') return true;
                    return this.getOutlookAssistTemplateColorPresetId(cardColor) === colorFilter;
                })
                .filter(t => {
                    const categoryLabel = this.getOutlookAssistTemplateCategoryLabel(t.category || 'other');
                    return !q || MaintenanceApp.toHalfWidthLower(`${t.title || ''} ${t.subject || ''} ${t.body || ''} ${categoryLabel} ${t.category || ''}`).includes(q);
                });
            if (!filtered.length) return `<div class="outlook-template-empty">${TXT.noTemplate}</div>`;
            return filtered.map(t => {
                const categoryId = this.getOutlookAssistTemplateCategoryId(t.category || 'other');
                const categoryLabel = this.getOutlookAssistTemplateCategoryLabel(categoryId);
                const cardColor = normalizeOutlookAssistTemplateColor(t.cardColor);
                const cardTextColor = getReadableTextColor(cardColor);
                const cardStyle = cardColor ? ` style="background:${this.escapeHtml(cardColor)}; border-color:${this.escapeHtml(cardColor)}; color:${this.escapeHtml(cardTextColor)};"` : '';
                const useCount = Math.max(0, Number(t.useCount) || 0);
                const lastUsed = formatUpdatedAt(t.lastUsedAt) || '-';
                return `
                <div class="outlook-template-item ${t.favorite ? 'favorite' : ''} ${cardColor ? 'has-card-color' : ''} ${compactCards ? 'compact' : ''}" draggable="true" ondragstart="app.startOutlookAssistTemplateDrag(event, '${this.escapeJs(t.id)}')" ondragend="app.clearOutlookAssistTemplateDrag()" ondragover="app.allowOutlookAssistTemplateDrop(event)" ondrop="app.dropOutlookAssistTemplate(event, '${this.escapeJs(t.id)}')">
                    <button type="button" onclick="app.applyOutlookAssistTemplate('${this.escapeJs(t.id)}')"${cardStyle}>
                        <b>${t.favorite ? '<i class="fa-solid fa-star"></i> ' : ''}${this.escapeHtml(t.title || TXT.unnamed)}</b>
                        <span class="outlook-template-subject">${this.escapeHtml(t.subject || TXT.noSubject)}</span>
                        <span class="outlook-template-meta"><em class="outlook-template-category-badge category-${this.escapeHtml(categoryId)}">${this.escapeHtml(categoryLabel)}</em><small>${TXT.usedCount}${useCount}${TXT.times}</small><small>${TXT.lastUsed}: ${this.escapeHtml(lastUsed)}</small></span>
                        ${showColorPresets ? `<span class="outlook-template-color-presets" aria-label="${TXT.colorPresets}">
                            ${TEMPLATE_COLOR_PRESETS.map(item => `<i title="${this.escapeHtml(item.label)}" style="background:${this.escapeHtml(item.color)}" onclick="event.stopPropagation(); app.setOutlookAssistTemplateColor('${this.escapeJs(t.id)}', '${this.escapeJs(item.color)}')"></i>`).join('')}
                        </span>` : ''}
                    </button>
                    <div class="outlook-template-item-actions">
                        <button type="button" class="icon-btn" title="${t.favorite ? TXT.unfavorite : TXT.favorite}" onclick="app.toggleOutlookAssistTemplateFavorite('${this.escapeJs(t.id)}')"><i class="fa-${t.favorite ? 'solid' : 'regular'} fa-star"></i></button>
                        <button type="button" class="icon-btn outlook-template-drag-handle" title="${TXT.dragTemplate}"><i class="fa-solid fa-grip-vertical"></i></button>
                        <label class="icon-btn outlook-template-color-btn" title="${TXT.changeColor}"><i class="fa-solid fa-palette"></i><input type="color" value="${this.escapeHtml(cardColor || '#ffffff')}" onchange="app.setOutlookAssistTemplateColor('${this.escapeJs(t.id)}', this.value)"></label>
                        <button type="button" class="icon-btn" title="${TXT.edit}" onclick="app.loadOutlookAssistTemplateForEdit('${this.escapeJs(t.id)}')"><i class="fa-solid fa-pen"></i></button>
                        <button type="button" class="icon-btn" title="${TXT.duplicate}" onclick="app.duplicateOutlookAssistTemplate('${this.escapeJs(t.id)}')"><i class="fa-regular fa-clone"></i></button>
                        <button type="button" class="icon-btn" title="${TXT.clearColor}" onclick="app.setOutlookAssistTemplateColor('${this.escapeJs(t.id)}', '')"><i class="fa-solid fa-droplet-slash"></i></button>
                        <button type="button" class="icon-btn danger" title="${TXT.delete}" onclick="app.deleteOutlookAssistTemplate('${this.escapeJs(t.id)}')"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
                `;
            }).join('');
        },

        renderOutlookAssistTemplates(query = document.getElementById('outlook-template-search')?.value || '') {
            const list = document.getElementById('outlook-template-list');
            const category = document.getElementById('outlook-template-filter-category')?.value || 'all';
            const color = document.getElementById('outlook-template-filter-color')?.value || 'all';
            const sortMode = document.getElementById('outlook-template-sort-mode')?.value || 'manual';
            const state = this.getOutlookAssistState();
            if (state.templateFilterCategory !== category) {
                state.templateFilterCategory = category;
                store.save();
            }
            if (state.templateFilterColor !== color) {
                state.templateFilterColor = color;
                store.save();
            }
            if (state.templateSortMode !== sortMode) {
                state.templateSortMode = sortMode;
                store.save();
            }
            if (list) list.innerHTML = this.getOutlookAssistTemplateListHtml(this.getOutlookAssistState().templates, query, category, color, state.showTemplateColorPresets, state.compactTemplateCards) + this.getOutlookAssistTemplateUndoHtml();
        },

        toggleOutlookAssistTemplateColorPresets() {
            const state = this.getOutlookAssistState();
            state.showTemplateColorPresets = !state.showTemplateColorPresets;
            store.save();
            this.renderOutlookAssist();
        },

        toggleOutlookAssistTemplateCompact() {
            const state = this.getOutlookAssistState();
            state.compactTemplateCards = !state.compactTemplateCards;
            store.save();
            this.renderOutlookAssist();
        },

        setOutlookAssistPersonalExportOption(key, checked) {
            const state = this.getOutlookAssistState();
            if (!state.personalExportOptions || typeof state.personalExportOptions !== 'object') state.personalExportOptions = {};
            state.personalExportOptions[key] = !!checked;
            store.save();
        },

        toggleOutlookAssistBodyTop() {
            const state = this.getOutlookAssistState();
            this.saveOutlookAssistDraftFromForm();
            state.bodyTopCollapsed = !state.bodyTopCollapsed;
            store.save();
            this.renderOutlookAssist();
            setTimeout(() => document.getElementById('outlook-assist-body')?.focus(), 0);
        },

        startOutlookAssistTemplateDrag(event, id) {
            this._outlookAssistDraggingTemplateId = id;
            event.dataTransfer?.setData('text/plain', id);
            event.dataTransfer?.setDragImage?.(event.currentTarget, 16, 16);
            event.currentTarget?.classList.add('dragging');
        },

        allowOutlookAssistTemplateDrop(event) {
            event.preventDefault();
        },

        clearOutlookAssistTemplateDrag() {
            this._outlookAssistDraggingTemplateId = '';
            document.querySelectorAll('.outlook-template-item.dragging').forEach(item => item.classList.remove('dragging'));
        },

        dropOutlookAssistTemplate(event, targetId) {
            event.preventDefault();
            const state = this.getOutlookAssistState();
            const sourceId = event.dataTransfer?.getData('text/plain') || this._outlookAssistDraggingTemplateId || '';
            this.clearOutlookAssistTemplateDrag();
            if (!sourceId || !targetId || sourceId === targetId) return;
            const ordered = this.sortOutlookAssistTemplates(state.templates, 'manual');
            const from = ordered.findIndex(item => item.id === sourceId);
            const to = ordered.findIndex(item => item.id === targetId);
            if (from < 0 || to < 0) return;
            const [moved] = ordered.splice(from, 1);
            ordered.splice(to, 0, moved);
            ordered.forEach((template, index) => { template.order = index + 1; });
            state.templateSortMode = 'manual';
            store.save();
            this.renderOutlookAssist();
        },

        renderOutlookAssistTemplateTitleWarning() {
            const target = document.getElementById('outlook-template-title-warning');
            if (target) target.innerHTML = this.getOutlookAssistTemplateTitleWarningHtml();
        },

        renderOutlookAssistPreview() {
            const preview = document.getElementById('outlook-copy-preview-text');
            const warning = document.getElementById('outlook-assist-warning');
            if (!preview && !warning) return;
            const draft = this.getCurrentOutlookAssistDraft();
            const warningText = this.getOutlookAssistMissingInsertWarning(draft);
            if (warning) {
                warning.hidden = !warningText;
                warning.textContent = warningText;
            }
            if (preview) preview.textContent = this.buildOutlookAssistCopyText();
        },

        renderOutlookAssistCopyChecklist() {
            const current = document.querySelector('.outlook-copy-checklist');
            if (current) current.outerHTML = this.getOutlookAssistCopyChecklistHtml();
        },

        renderOutlookAssistAssistPanels() {
            const next = document.getElementById('outlook-next-copy-guide');
            if (next) next.outerHTML = this.getOutlookAssistNextCopyHtml();
            const recipient = document.getElementById('outlook-recipient-check');
            if (recipient) recipient.outerHTML = this.getOutlookAssistRecipientCheckHtml();
            const diff = document.getElementById('outlook-template-diff');
            if (diff) diff.outerHTML = this.getOutlookAssistTemplateDiffHtml();
        },

        attachOutlookAssistPlainPasteHandlers() {
            ['outlook-assist-to', 'outlook-assist-cc', 'outlook-assist-bcc', 'outlook-assist-subject'].forEach(id => {
                const el = document.getElementById(id);
                if (!el || el.dataset.plainPasteReady) return;
                el.dataset.plainPasteReady = 'true';
                el.addEventListener('paste', event => this.pastePlainTextIntoInput(event));
            });
        },

        pastePlainTextIntoInput(event) {
            event.preventDefault();
            const text = normalizePlainText(event.clipboardData?.getData('text/plain') || '').replace(/\n+/g, ' ');
            const el = event.currentTarget;
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            el.value = el.value.slice(0, start) + text + el.value.slice(end);
            el.selectionStart = el.selectionEnd = start + text.length;
            this.saveOutlookAssistDraftFromForm();
        },

        pastePlainTextIntoOutlookBody(event) {
            event.preventDefault();
            const text = normalizePlainText(event.clipboardData?.getData('text/plain') || '');
            const el = event.currentTarget;
            const start = el.selectionStart ?? el.value.length;
            const end = el.selectionEnd ?? el.value.length;
            el.value = el.value.slice(0, start) + text + el.value.slice(end);
            el.selectionStart = el.selectionEnd = start + text.length;
            this.onOutlookAssistBodyInput();
        },

        handleOutlookAssistBodyKeydown(event) {
            if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
            const draft = this.getCurrentOutlookAssistDraft();
            const mergeWrap = !!document.getElementById('outlook-assist-merge-wrap')?.checked || !!draft.mergeWrap;
            if (!mergeWrap) return;
            event.preventDefault();
            const body = event.currentTarget;
            const selectionStart = body.selectionStart ?? body.value.length;
            const selectionEnd = body.selectionEnd ?? selectionStart;
            const value = body.value.slice(0, selectionStart) + body.value.slice(selectionEnd);
            const cursor = selectionStart;
            const lineStart = value.lastIndexOf('\n', cursor - 1) + 1;
            const lineEndRaw = value.indexOf('\n', cursor);
            const lineEnd = lineEndRaw >= 0 ? lineEndRaw : value.length;
            const beforeAll = value.slice(0, lineStart);
            const beforeCursor = value.slice(lineStart, cursor);
            const afterCursor = value.slice(cursor, lineEnd);
            const afterLine = value.slice(lineEnd);
            if (afterLine.startsWith('\n')) {
                body.value = `${beforeAll}${beforeCursor}\n${afterCursor}${afterLine.slice(1)}`;
            } else {
                body.value = `${beforeAll}${beforeCursor}\n${afterCursor}${afterLine}`;
            }
            const nextCursor = beforeAll.length + beforeCursor.length + 1;
            body.selectionStart = body.selectionEnd = nextCursor;
            this.onOutlookAssistBodyInput();
        },

        getOutlookAssistBodyHistory() {
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return null;
            if (!this._outlookAssistBodyHistoryByWorker) this._outlookAssistBodyHistoryByWorker = {};
            const key = `${worker}::${this.getOutlookAssistDraftPageIndex(worker)}`;
            if (!this._outlookAssistBodyHistoryByWorker[key]) {
                this._outlookAssistBodyHistoryByWorker[key] = {
                    undo: [],
                    redo: [],
                    current: String(this.getCurrentOutlookAssistDraft().body || '')
                };
            }
            return this._outlookAssistBodyHistoryByWorker[key];
        },

        syncOutlookAssistBodyHistory(value) {
            const history = this.getOutlookAssistBodyHistory();
            if (!history) return;
            const next = String(value || '');
            if (typeof history.current !== 'string') {
                history.current = next;
                return;
            }
            if (history.current === next) return;
            history.undo.push(history.current);
            if (history.undo.length > 80) history.undo.shift();
            history.redo = [];
            history.current = next;
        },

        recordOutlookAssistBodyHistory(nextValue) {
            const history = this.getOutlookAssistBodyHistory();
            if (!history) return;
            const next = String(nextValue || '');
            if (history.current === next) {
                this.updateOutlookAssistBodyHistoryButtons();
                return;
            }
            history.undo.push(history.current);
            if (history.undo.length > 80) history.undo.shift();
            history.redo = [];
            history.current = next;
            this.updateOutlookAssistBodyHistoryButtons();
        },

        updateOutlookAssistBodyHistoryButtons() {
            const history = this.getOutlookAssistBodyHistory();
            const undoBtn = document.getElementById('outlook-body-undo-btn');
            const redoBtn = document.getElementById('outlook-body-redo-btn');
            if (undoBtn) undoBtn.disabled = !history?.undo?.length;
            if (redoBtn) redoBtn.disabled = !history?.redo?.length;
        },

        applyOutlookAssistBodyHistoryValue(value) {
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            body.value = String(value || '');
            body.selectionStart = body.selectionEnd = body.value.length;
            this.saveOutlookAssistDraftFromForm();
            this.updateOutlookAssistBodyHistoryButtons();
            body.focus();
        },

        undoOutlookAssistBody() {
            const body = document.getElementById('outlook-assist-body');
            const history = this.getOutlookAssistBodyHistory();
            if (!body || !history?.undo?.length) return;
            const current = body.value;
            const previous = history.undo.pop();
            history.redo.push(current);
            history.current = previous;
            this.applyOutlookAssistBodyHistoryValue(previous);
        },

        redoOutlookAssistBody() {
            const body = document.getElementById('outlook-assist-body');
            const history = this.getOutlookAssistBodyHistory();
            if (!body || !history?.redo?.length) return;
            const current = body.value;
            const next = history.redo.pop();
            history.undo.push(current);
            history.current = next;
            this.applyOutlookAssistBodyHistoryValue(next);
        },

        onOutlookAssistBodyInput(event) {
            const draft = this.getCurrentOutlookAssistDraft();
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            if (event?.isComposing || body.dataset.composing === 'true') {
                this.saveOutlookAssistDraftFromForm();
                return;
            }
            if (draft.autoWrap) {
                const mergeWrap = !!document.getElementById('outlook-assist-merge-wrap')?.checked || !!draft.mergeWrap;
                const transform = value => mergeWrap ? wrapTextByMergingNextLine(value, draft.wrapAt) : wrapText(value, draft.wrapAt);
                setTextareaValuePreservingCursor(body, transform(body.value), transform);
            }
            this.recordOutlookAssistBodyHistory(body.value);
            this.saveOutlookAssistDraftFromForm();
        },

        applyOutlookAssistWrap(force = false) {
            const draft = this.getCurrentOutlookAssistDraft();
            const body = document.getElementById('outlook-assist-body');
            const mergeWrap = !!document.getElementById('outlook-assist-merge-wrap')?.checked || !!draft.mergeWrap;
            if (body && (draft.autoWrap || force)) {
                const transform = value => mergeWrap ? wrapTextByMergingNextLine(value, draft.wrapAt) : wrapText(value, draft.wrapAt);
                setTextareaValuePreservingCursor(body, transform(body.value), transform);
            }
            if (body) this.recordOutlookAssistBodyHistory(body.value);
            this.saveOutlookAssistDraftFromForm();
        },

        toggleOutlookAssistMergeWrap(checked) {
            this.saveOutlookAssistDraftFromForm();
            document.querySelector('.outlook-merge-wrap-control')?.classList.toggle('active', !!checked);
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) return;
            const draft = this.getCurrentOutlookAssistDraft();
            this.setCurrentOutlookAssistDraft({ ...draft, mergeWrap: !!checked, updatedAt: new Date().toISOString() });
            store.save();
            this.applyOutlookAssistWrap();
        },

        unwrapOutlookAssistBody() {
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            body.value = unwrapText(body.value);
            this.recordOutlookAssistBodyHistory(body.value);
            this.saveOutlookAssistDraftFromForm();
            body.focus();
        },

        removeOutlookAssistBlankLines() {
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            const removeBlankLines = value => normalizePlainText(value)
                .split('\n')
                .filter(line => line.trim() !== '')
                .join('\n');
            const value = body.value;
            const start = body.selectionStart ?? 0;
            const end = body.selectionEnd ?? start;
            if (start !== end) {
                const cleaned = removeBlankLines(value.slice(start, end));
                body.value = value.slice(0, start) + cleaned + value.slice(end);
                body.setSelectionRange(start, start + cleaned.length);
            } else {
                setTextareaValuePreservingCursor(body, removeBlankLines(value), removeBlankLines);
            }
            this.recordOutlookAssistBodyHistory(body.value);
            this.saveOutlookAssistDraftFromForm();
            body.focus();
        },

        insertOutlookAssistVariable(token) {
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            const start = body.selectionStart ?? body.value.length;
            const end = body.selectionEnd ?? body.value.length;
            body.value = body.value.slice(0, start) + token + body.value.slice(end);
            body.selectionStart = body.selectionEnd = start + token.length;
            this.onOutlookAssistBodyInput();
            body.focus();
        },

        insertOutlookAssistVariableToField(field, token) {
            const targetId = field === 'subject' ? 'outlook-assist-subject' : 'outlook-assist-body';
            const input = document.getElementById(targetId);
            if (!input) return;
            const start = input.selectionStart ?? input.value.length;
            const end = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, start) + token + input.value.slice(end);
            input.selectionStart = input.selectionEnd = start + token.length;
            if (field === 'subject') this.saveOutlookAssistDraftFromForm();
            else this.onOutlookAssistBodyInput();
            input.focus();
        },

        insertOutlookAssistQuickPhrase(phrase) {
            const body = document.getElementById('outlook-assist-body');
            if (!body) return;
            const text = normalizePlainText(phrase || '');
            const start = body.selectionStart ?? body.value.length;
            const end = body.selectionEnd ?? body.value.length;
            const prefix = start > 0 && body.value[start - 1] !== '\n' ? '\n' : '';
            const suffix = body.value.slice(end, end + 1) && body.value.slice(end, end + 1) !== '\n' ? '\n' : '';
            body.value = body.value.slice(0, start) + prefix + text + suffix + body.value.slice(end);
            const position = start + prefix.length + text.length;
            body.selectionStart = body.selectionEnd = position;
            this.onOutlookAssistBodyInput();
            body.focus();
            this.showToast(TXT.inserted, 'success');
        },

        renderOutlookAssistQuickPhrases() {
            const current = document.querySelector('.outlook-quick-phrases');
            if (current) current.outerHTML = this.getOutlookAssistQuickPhrasesHtml();
        },

        editOutlookAssistQuickPhrase(index) {
            const phrases = this.getOutlookAssistState().quickPhrases || [];
            if (index < 0 || index >= phrases.length) return;
            this._outlookAssistEditingQuickPhraseIndex = index;
            this.renderOutlookAssistQuickPhrases();
            setTimeout(() => document.getElementById('outlook-quick-phrase-input')?.focus(), 0);
        },

        saveOutlookAssistQuickPhrase() {
            const state = this.getOutlookAssistState();
            const text = normalizePlainText(document.getElementById('outlook-quick-phrase-input')?.value || '').trim();
            if (!text) return;
            const editingIndex = Number.isInteger(this._outlookAssistEditingQuickPhraseIndex) ? this._outlookAssistEditingQuickPhraseIndex : -1;
            const phrases = state.quickPhrases || [];
            if (editingIndex >= 0 && editingIndex < phrases.length) phrases[editingIndex] = { ...phrases[editingIndex], text };
            else phrases.push({ text, visible: true });
            state.quickPhrases = phrases;
            this._outlookAssistEditingQuickPhraseIndex = -1;
            store.save();
            this.renderOutlookAssistQuickPhrases();
            this.showToast(TXT.phraseSaved, 'success');
        },

        toggleOutlookAssistQuickPhraseVisible(index) {
            const state = this.getOutlookAssistState();
            const phrases = state.quickPhrases || [];
            if (index < 0 || index >= phrases.length) return;
            phrases[index].visible = phrases[index].visible === false;
            state.quickPhrases = phrases;
            store.save();
            this.renderOutlookAssistQuickPhrases();
        },

        toggleOutlookAssistHiddenQuickPhrasesPanel() {
            this._outlookAssistShowHiddenQuickPhrases = !this._outlookAssistShowHiddenQuickPhrases;
            this.renderOutlookAssistQuickPhrases();
        },

        restoreOutlookAssistQuickPhrase(index) {
            const state = this.getOutlookAssistState();
            const phrases = state.quickPhrases || [];
            if (index < 0 || index >= phrases.length) return;
            phrases[index].visible = true;
            state.quickPhrases = phrases;
            this._outlookAssistShowHiddenQuickPhrases = false;
            store.save();
            this.renderOutlookAssistQuickPhrases();
        },

        deleteOutlookAssistQuickPhrase(index) {
            const state = this.getOutlookAssistState();
            const phrases = state.quickPhrases || [];
            if (index < 0 || index >= phrases.length) return;
            phrases.splice(index, 1);
            state.quickPhrases = phrases;
            this._outlookAssistEditingQuickPhraseIndex = -1;
            store.save();
            this.renderOutlookAssistQuickPhrases();
            this.showToast(TXT.phraseDeleted, 'info');
        },

        addOutlookAssistSubjectPreset(prefix) {
            const input = document.getElementById('outlook-assist-subject');
            if (!input) return;
            const text = normalizePlainText(prefix || '').replace(/\n+/g, ' ').trim();
            if (!text) return;
            const current = input.value.trim();
            input.value = current.startsWith(text) ? current : `${text}${current ? ' ' : ''}${current}`;
            this.saveOutlookAssistDraftFromForm();
            input.focus();
            this.showToast(TXT.prefixAdded, 'success');
        },

        editOutlookAssistSubjectPreset(index) {
            const presets = this.getOutlookAssistState().subjectPresets || [];
            if (index < 0 || index >= presets.length) return;
            this._outlookAssistEditingSubjectPresetIndex = index;
            const current = document.querySelector('.outlook-subject-preset-bar');
            if (current) current.outerHTML = this.getOutlookAssistSubjectPresetsHtml();
            setTimeout(() => document.getElementById('outlook-subject-preset-input')?.focus(), 0);
        },

        saveOutlookAssistSubjectPreset() {
            const state = this.getOutlookAssistState();
            const text = normalizePlainText(document.getElementById('outlook-subject-preset-input')?.value || '').replace(/\n+/g, ' ').trim();
            if (!text) return;
            const editingIndex = Number.isInteger(this._outlookAssistEditingSubjectPresetIndex) ? this._outlookAssistEditingSubjectPresetIndex : -1;
            const presets = state.subjectPresets || [];
            if (editingIndex >= 0 && editingIndex < presets.length) presets[editingIndex] = text;
            else if (!presets.includes(text)) presets.push(text);
            state.subjectPresets = presets;
            this._outlookAssistEditingSubjectPresetIndex = -1;
            store.save();
            const current = document.querySelector('.outlook-subject-preset-bar');
            if (current) current.outerHTML = this.getOutlookAssistSubjectPresetsHtml();
            this.showToast(TXT.presetSaved, 'success');
        },

        deleteOutlookAssistSubjectPreset(index) {
            const state = this.getOutlookAssistState();
            const presets = state.subjectPresets || [];
            if (index < 0 || index >= presets.length) return;
            presets.splice(index, 1);
            state.subjectPresets = presets;
            this._outlookAssistEditingSubjectPresetIndex = -1;
            store.save();
            const current = document.querySelector('.outlook-subject-preset-bar');
            if (current) current.outerHTML = this.getOutlookAssistSubjectPresetsHtml();
            this.showToast(TXT.presetDeleted, 'info');
        },

        saveOutlookAssistDraftFromForm() {
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) return;
            const previous = this.getCurrentOutlookAssistDraft();
            const pageTitleInput = normalizePlainText(getFieldValue('outlook-assist-page-title')).replace(/\n+/g, ' ').trim();
            const subjectInput = normalizePlainText(getFieldValue('outlook-assist-subject')).replace(/\n+/g, ' ');
            const pageTitleLocked = !!document.getElementById('outlook-assist-page-title-lock')?.checked;
            const pageColorInput = normalizeOutlookAssistTemplateColor(document.getElementById('outlook-assist-page-color')?.value || '');
            const previousPageTitle = String(previous.pageTitle || '').trim();
            const previousSubject = String(previous.subject || '').trim();
            const shouldAutoPageTitle = !pageTitleLocked && (!pageTitleInput || (pageTitleInput === previousPageTitle && previousPageTitle === previousSubject));
            const nextDraft = {
                pageTitle: shouldAutoPageTitle ? subjectInput.trim() : pageTitleInput,
                pageTitleLocked,
                pageColor: pageColorInput === '#ffffff' ? '' : pageColorInput,
                to: normalizePlainText(getFieldValue('outlook-assist-to')).replace(/\n+/g, ' '),
                cc: normalizePlainText(getFieldValue('outlook-assist-cc')).replace(/\n+/g, ' '),
                bcc: normalizePlainText(getFieldValue('outlook-assist-bcc')).replace(/\n+/g, ' '),
                subject: subjectInput,
                machineName: normalizePlainText(getFieldValue('outlook-assist-machine')).replace(/\n+/g, ' '),
                insertLabel: this.getOutlookAssistInsertLabel(),
                body: normalizePlainText(getFieldValue('outlook-assist-body')),
                wrapAt: Math.max(10, Math.min(120, Number(getFieldValue('outlook-assist-wrap-at')) || DEFAULT_WRAP_AT)),
                autoWrap: !!document.getElementById('outlook-assist-auto-wrap')?.checked,
                updatedAt: new Date().toISOString()
            };
            const status = this.getOutlookAssistCopyStatus(worker);
            ['to', 'cc', 'bcc', 'subject', 'body'].forEach(field => {
                if (String(previous[field] || '') !== String(nextDraft[field] || '')) status[field] = false;
            });
            if (String(previous.machineName || '') !== String(nextDraft.machineName || '')) {
                ['to', 'cc', 'bcc', 'subject', 'body'].forEach(field => {
                    if (`${previous[field] || ''}\n${nextDraft[field] || ''}`.includes(TXT.varMachine)) status[field] = false;
                });
            }
            this.setCurrentOutlookAssistDraft(nextDraft);
            clearTimeout(this._outlookAssistSaveTimer);
            this.renderOutlookAssistPreview();
            this.renderOutlookAssistCopyChecklist();
            this.renderOutlookAssistAssistPanels();
            this._outlookAssistSaveTimer = setTimeout(() => {
                store.save();
                this.renderOutlookAssistWorkers();
            }, 250);
        },

        buildOutlookAssistCopyText() {
            const draft = this.getCurrentOutlookAssistDraft();
            return [
                draft.to ? `${TXT.mailTo}${this.applyOutlookAssistVariables(draft.to)}` : '',
                draft.cc ? `${TXT.mailCc}${this.applyOutlookAssistVariables(draft.cc)}` : '',
                draft.bcc ? `${TXT.mailBcc}${this.applyOutlookAssistVariables(draft.bcc)}` : '',
                draft.subject ? `${TXT.mailSubject}${this.applyOutlookAssistVariables(draft.subject)}` : '',
                draft.body ? `\n${this.applyOutlookAssistVariables(draft.body)}` : ''
            ].filter(Boolean).join('\n');
        },

        async copyOutlookAssistText(text, label = '\u30b3\u30d4\u30fc') {
            try {
                await navigator.clipboard.writeText(text || '');
            } catch (_) {
                const temp = document.createElement('textarea');
                temp.value = text || '';
                temp.style.position = 'fixed';
                temp.style.left = '-9999px';
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                temp.remove();
            }
            this.showToast(`${label}${TXT.copied}`, 'success');
        },

        copyOutlookAssistAll() {
            this.saveOutlookAssistDraftFromForm();
            const issues = this.getOutlookAssistRecipientIssues();
            if (issues.length && !confirm(`${TXT.copyWithRecipientIssues}\n${issues.join('\n')}`)) return;
            this.recordOutlookAssistInsertHistory(this.getCurrentOutlookAssistDraft().machineName);
            const status = this.getOutlookAssistCopyStatus();
            ['to', 'cc', 'bcc', 'subject', 'body'].forEach(field => { status[field] = true; });
            store.save();
            this.renderOutlookAssistCopyChecklist();
            this.renderOutlookAssistAssistPanels();
            this.copyOutlookAssistText(this.buildOutlookAssistCopyText(), TXT.copyAll);
        },

        copyOutlookAssistField(field) {
            this.saveOutlookAssistDraftFromForm();
            const draft = this.getCurrentOutlookAssistDraft();
            this.recordOutlookAssistInsertHistory(draft.machineName);
            const labelMap = { to: TXT.copyTo, cc: TXT.copyCc, bcc: TXT.copyBcc, subject: TXT.copySubject, body: TXT.copyBody };
            this.getOutlookAssistCopyStatus()[field] = true;
            store.save();
            this.renderOutlookAssistCopyChecklist();
            this.renderOutlookAssistAssistPanels();
            this.copyOutlookAssistText(this.applyOutlookAssistVariables(draft[field] || ''), labelMap[field] || '\u30b3\u30d4\u30fc');
        },

        applyOutlookAssistInsertHistory(value) {
            const input = document.getElementById('outlook-assist-machine');
            if (!input) return;
            input.value = value || '';
            this.saveOutlookAssistDraftFromForm();
            input.focus();
        },

        saveOutlookAssistRecipientSet() {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const draft = this.getCurrentOutlookAssistDraft();
            const name = (document.getElementById('outlook-recipient-set-name')?.value || '').trim();
            if (!name) return this.showToast(TXT.recipientSetName, 'warning');
            const existing = state.recipientSets.find(set => set.name === name);
            const record = {
                id: existing?.id || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                name,
                to: draft.to || '',
                cc: draft.cc || '',
                bcc: draft.bcc || '',
                updatedAt: new Date().toISOString()
            };
            if (existing) Object.assign(existing, record);
            else state.recipientSets.push(record);
            store.save();
            this.renderOutlookAssist();
        },

        applyOutlookAssistRecipientSet(id) {
            const state = this.getOutlookAssistState();
            const set = (state.recipientSets || []).find(item => item.id === id);
            const worker = state.selectedWorker;
            if (!set || !worker) return;
            const draft = this.getCurrentOutlookAssistDraft();
            this.setCurrentOutlookAssistDraft({
                ...draft,
                to: set.to || '',
                cc: set.cc || '',
                bcc: set.bcc || '',
                updatedAt: new Date().toISOString()
            });
            const status = this.getOutlookAssistCopyStatus(worker);
            status.to = false;
            status.cc = false;
            status.bcc = false;
            store.save();
            this.renderOutlookAssist();
        },

        deleteOutlookAssistRecipientSet(id) {
            const state = this.getOutlookAssistState();
            state.recipientSets = (state.recipientSets || []).filter(set => set.id !== id);
            store.save();
            this.renderOutlookAssist();
        },

        openOutlookAssistAddressBook(mode = 'manage', target = 'to') {
            this._outlookAssistAddressBookOpen = true;
            this._outlookAssistAddressBookMode = mode;
            this._outlookAssistAddressBookTarget = ['to', 'cc', 'bcc'].includes(target) ? target : 'to';
            this.renderOutlookAssist();
        },

        closeOutlookAssistAddressBook() {
            this._outlookAssistAddressBookOpen = false;
            this._outlookAssistEditingRecipientContactId = '';
            this._outlookAssistManagingGroup = '';
            this._outlookAssistAddressBookQuery = '';
            this.renderOutlookAssist();
        },

        filterOutlookAssistAddressBook(query) {
            this._outlookAssistAddressBookQuery = String(query || '');
            this.renderOutlookAssist();
        },

        touchOutlookAssistRecipientGroup(group) {
            const state = this.getOutlookAssistState();
            const key = String(group || TXT.noGroup).trim() || TXT.noGroup;
            state.recipientGroupUpdatedAt[key] = new Date().toISOString();
        },

        touchOutlookAssistRecipientGroups(groups) {
            const items = normalizeOutlookAssistGroups(groups);
            (items.length ? items : [TXT.noGroup]).forEach(group => this.touchOutlookAssistRecipientGroup(group));
        },

        editOutlookAssistRecipientContact(id) {
            const contact = this.getOutlookAssistState().recipientContacts.find(item => item.id === id);
            if (!contact) return;
            this._outlookAssistEditingRecipientContactId = id;
            this.renderOutlookAssist();
            setTimeout(() => document.getElementById('outlook-address-family')?.focus(), 0);
        },

        clearOutlookAssistRecipientContactEdit() {
            this._outlookAssistEditingRecipientContactId = '';
            this.renderOutlookAssist();
        },

        openOutlookAssistGroupManager(group) {
            this._outlookAssistManagingGroup = String(group || '').trim();
            this.renderOutlookAssist();
        },

        prepareOutlookAssistNewContactForGroup(group) {
            const groupName = String(group || '').trim();
            if (!groupName || groupName === TXT.noGroup) return;
            this._outlookAssistEditingRecipientContactId = '';
            this._outlookAssistManagingGroup = groupName;
            this.renderOutlookAssist();
            setTimeout(() => {
                const groupInput = document.getElementById('outlook-address-group');
                if (groupInput) groupInput.value = groupName;
                document.getElementById('outlook-address-family')?.focus();
            }, 0);
        },

        addOutlookAssistContactToGroup(id, group) {
            const state = this.getOutlookAssistState();
            const contact = state.recipientContacts.find(item => item.id === id);
            const groupName = String(group || '').trim();
            if (!contact || !groupName || groupName === TXT.noGroup) return;
            const groups = normalizeOutlookAssistGroups(contact.groups || contact.group);
            if (groups.includes(groupName)) return;
            if (groups.length >= 7) return this.showToast(TXT.groupLimit, 'warning');
            groups.push(groupName);
            contact.groups = groups;
            contact.group = groups[0] || '';
            contact.updatedAt = new Date().toISOString();
            this.touchOutlookAssistRecipientGroup(groupName);
            store.save();
            this.showToast(TXT.groupUpdated, 'success');
            this.renderOutlookAssist();
        },

        removeOutlookAssistContactFromGroup(id, group) {
            const state = this.getOutlookAssistState();
            const contact = state.recipientContacts.find(item => item.id === id);
            const groupName = String(group || '').trim();
            if (!contact || !groupName || groupName === TXT.noGroup) return;
            const groups = normalizeOutlookAssistGroups(contact.groups || contact.group).filter(item => item !== groupName);
            contact.groups = groups;
            contact.group = groups[0] || '';
            contact.updatedAt = new Date().toISOString();
            this.touchOutlookAssistRecipientGroup(groupName);
            store.save();
            this.showToast(TXT.groupUpdated, 'info');
            this.renderOutlookAssist();
        },

        deleteOutlookAssistRecipientGroup(group) {
            const state = this.getOutlookAssistState();
            const groupName = String(group || '').trim();
            if (!groupName || groupName === TXT.noGroup) return;
            let changed = false;
            state.recipientContacts.forEach(contact => {
                const groups = normalizeOutlookAssistGroups(contact.groups || contact.group);
                if (!groups.includes(groupName)) return;
                const nextGroups = groups.filter(item => item !== groupName);
                contact.groups = nextGroups;
                contact.group = nextGroups[0] || '';
                contact.updatedAt = new Date().toISOString();
                changed = true;
            });
            if (!changed) return;
            delete state.recipientGroupUpdatedAt[groupName];
            delete state.recipientGroupColors[groupName];
            this._outlookAssistManagingGroup = '';
            store.save();
            this.showToast(TXT.groupDeleted, 'info');
            this.renderOutlookAssist();
        },

        saveOutlookAssistRecipientContact() {
            const state = this.getOutlookAssistState();
            const familyName = normalizePlainText(document.getElementById('outlook-address-family')?.value || '').replace(/\n+/g, ' ').trim();
            const givenName = normalizePlainText(document.getElementById('outlook-address-given')?.value || '').replace(/\n+/g, ' ').trim();
            const email = normalizePlainText(document.getElementById('outlook-address-email')?.value || '').replace(/\n+/g, ' ').trim();
            const groupText = normalizePlainText(document.getElementById('outlook-address-group')?.value || '').trim();
            const groups = normalizeOutlookAssistGroups(groupText);
            const note = normalizePlainText(document.getElementById('outlook-address-note')?.value || '').replace(/\n+/g, ' ').trim();
            if (!familyName) return this.showToast(TXT.familyRequired, 'warning');
            if (!email) return this.showToast(TXT.emailRequired, 'warning');
            if (groupText.split(/[,\u3001;\n]+/).map(item => item.trim()).filter(Boolean).length > 7) return this.showToast(TXT.groupLimit, 'warning');
            const editingId = this._outlookAssistEditingRecipientContactId || '';
            const duplicate = state.recipientContacts.find(contact => contact.id !== editingId && contact.email.toLowerCase() === email.toLowerCase());
            if (duplicate) return this.showToast(TXT.duplicateEmail, 'warning');
            const existing = state.recipientContacts.find(contact => contact.id === editingId) || state.recipientContacts.find(contact => contact.email.toLowerCase() === email.toLowerCase());
            const previousGroups = normalizeOutlookAssistGroups(existing?.groups || existing?.group);
            const record = {
                id: existing?.id || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                familyName,
                givenName,
                email,
                group: groups[0] || '',
                groups,
                note,
                updatedAt: new Date().toISOString()
            };
            if (existing) Object.assign(existing, record);
            else state.recipientContacts.push(record);
            this.touchOutlookAssistRecipientGroups(groups);
            previousGroups.filter(group => !groups.includes(group)).forEach(group => this.touchOutlookAssistRecipientGroup(group));
            this._outlookAssistEditingRecipientContactId = '';
            store.save();
            this.showToast(TXT.saved, 'success');
            this.renderOutlookAssist();
        },

        deleteOutlookAssistRecipientContact(id) {
            const state = this.getOutlookAssistState();
            const contact = state.recipientContacts.find(item => item.id === id);
            if (!contact) return;
            state.recipientContacts = state.recipientContacts.filter(item => item.id !== id);
            this.touchOutlookAssistRecipientGroups(contact.groups || contact.group);
            if (this._outlookAssistEditingRecipientContactId === id) this._outlookAssistEditingRecipientContactId = '';
            store.save();
            this.showToast(TXT.removed, 'info');
            this.renderOutlookAssist();
        },

        appendOutlookAssistEmailsToField(field, emails) {
            const targetId = field === 'cc' ? 'outlook-assist-cc' : (field === 'bcc' ? 'outlook-assist-bcc' : 'outlook-assist-to');
            const input = document.getElementById(targetId);
            if (!input) return;
            const current = this.splitOutlookAssistRecipients(input.value);
            const lower = new Set(current.map(item => item.toLowerCase()));
            emails.filter(Boolean).forEach(email => {
                if (!lower.has(email.toLowerCase())) {
                    current.push(email);
                    lower.add(email.toLowerCase());
                }
            });
            input.value = current.join('; ');
            this.saveOutlookAssistDraftFromForm();
            input.focus();
        },

        addOutlookAssistRecipientContactToField(id, field = this._outlookAssistAddressBookTarget || 'to') {
            const contact = this.getOutlookAssistState().recipientContacts.find(item => item.id === id);
            if (!contact) return;
            this.focusOutlookAssistRecipientField(field);
            this.appendOutlookAssistEmailsToField(field, [contact.email]);
            this.blurOutlookAssistRecipientField(field);
            this.showToast(TXT.inserted, 'success');
        },

        addOutlookAssistRecipientGroupToField(group, field = this._outlookAssistAddressBookTarget || 'to') {
            const contacts = this.getOutlookAssistState().recipientContacts || [];
            const key = String(group || TXT.noGroup);
            const emails = contacts
                .filter(contact => {
                    const groups = normalizeOutlookAssistGroups(contact.groups || contact.group);
                    return (groups.length ? groups : [TXT.noGroup]).includes(key);
                })
                .map(contact => contact.email);
            if (!emails.length) return this.showToast(TXT.noContact, 'warning');
            this.focusOutlookAssistRecipientField(field);
            this.appendOutlookAssistEmailsToField(field, emails);
            this.blurOutlookAssistRecipientField(field);
            this.showToast(TXT.inserted, 'success');
        },

        loadOutlookAssistTemplateForEdit(id) {
            const state = this.getOutlookAssistState();
            const template = state.templates.find(t => t.id === id);
            const worker = state.selectedWorker;
            if (!template || !worker) return;
            if (this._outlookAssistEditingTemplateId === id) {
                this.clearOutlookAssistTemplateEditMode();
                return;
            }
            if (this._outlookAssistEditingTemplateId && this._outlookAssistTemplateEditDraftBackup) {
                const currentEditing = this.getOutlookAssistEditingTemplate();
                if (currentEditing && this.hasOutlookAssistTemplateEditChanges(currentEditing)) {
                    const saveAndSwitch = confirm('\u7de8\u96c6\u4e2d\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306b\u5909\u66f4\u304c\u3042\u308a\u307e\u3059\u3002\n\u4fdd\u5b58\u3057\u3066\u304b\u3089\u5225\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u7de8\u96c6\u3057\u307e\u3059\u304b\uff1f');
                    if (saveAndSwitch) {
                        this.saveOutlookAssistTemplate('overwrite', { skipOverwriteConfirm: true });
                    } else if (!confirm('\u4fdd\u5b58\u305b\u305a\u306b\u5225\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u7de8\u96c6\u3078\u5207\u308a\u66ff\u3048\u307e\u3059\u304b\uff1f')) {
                        return;
                    }
                }
                this.restoreOutlookAssistDraftAfterTemplateEdit();
                this._outlookAssistEditingTemplateId = '';
            } else {
                this.saveOutlookAssistDraftFromForm();
            }
            const draftIndex = this.getOutlookAssistDraftPageIndex(worker);
            this._outlookAssistTemplateEditDraftBackup = {
                worker,
                index: draftIndex,
                draft: normalizeOutlookAssistDraftRecord(this.getCurrentOutlookAssistDraft())
            };
            this._outlookAssistEditingTemplateId = id;
            this.setCurrentOutlookAssistDraft({
                ...this.getCurrentOutlookAssistDraft(),
                to: template.to || '',
                cc: template.cc || '',
                bcc: template.bcc || '',
                subject: template.subject || '',
                machineName: template.machineName || '',
                insertLabel: template.insertLabel || TXT.machine,
                body: template.body || '',
                wrapAt: template.wrapAt || DEFAULT_WRAP_AT,
                autoWrap: true,
                mergeWrap: false,
                updatedAt: new Date().toISOString()
            });
            const status = this.getOutlookAssistCopyStatus(worker);
            ['to', 'cc', 'bcc', 'subject', 'body'].forEach(field => { status[field] = false; });
            store.save();
            this.renderOutlookAssist();
            setTimeout(() => document.getElementById('outlook-template-title')?.focus(), 0);
            this.showToast(TXT.editLoaded, 'success');
        },

        restoreOutlookAssistDraftAfterTemplateEdit() {
            const backup = this._outlookAssistTemplateEditDraftBackup;
            this._outlookAssistTemplateEditDraftBackup = null;
            if (!backup?.worker || !backup?.draft) return;
            const state = this.getOutlookAssistState();
            const pages = this.getOutlookAssistDraftPages(backup.worker);
            const index = Math.max(0, Math.min(pages.length - 1, Number(backup.index) || 0));
            pages[index] = normalizeOutlookAssistDraftRecord(backup.draft);
            state.draftPagesByWorker[backup.worker] = pages;
            state.draftPageIndexByWorker[backup.worker] = index;
            state.draftsByWorker[backup.worker] = pages[index];
        },

        clearOutlookAssistTemplateEditMode(options = {}) {
            const editing = this.getOutlookAssistEditingTemplate();
            if (editing && !options.skipConfirm && this.hasOutlookAssistTemplateEditChanges(editing)) {
                const saveAndReturn = confirm('\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u306b\u5909\u66f4\u304c\u3042\u308a\u307e\u3059\u3002\n\u4fdd\u5b58\u3057\u3066\u4e0b\u66f8\u304d\u306b\u623b\u308a\u307e\u3059\u304b\uff1f');
                if (saveAndReturn) {
                    this.saveOutlookAssistTemplate('overwrite', { skipOverwriteConfirm: true, returnAfterSave: true });
                    return;
                }
                const discardAndReturn = confirm('\u4fdd\u5b58\u305b\u305a\u306b\u4e0b\u66f8\u304d\u306b\u623b\u308a\u307e\u3059\u304b\uff1f');
                if (!discardAndReturn) return;
            }
            this.restoreOutlookAssistDraftAfterTemplateEdit();
            this._outlookAssistEditingTemplateId = '';
            store.save();
            this.renderOutlookAssist();
        },

        buildOutlookAssistTemplateRecord(existing = null, title = '', category = 'other', insertLabel = TXT.machine, cardColor = '', draft = this.getCurrentOutlookAssistDraft()) {
            return {
                id: existing?.id || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title,
                category,
                cardColor: normalizeOutlookAssistTemplateColor(cardColor),
                favorite: existing?.favorite || false,
                order: existing?.order ?? this.getNextOutlookAssistTemplateOrder(),
                to: draft.to,
                cc: draft.cc,
                bcc: draft.bcc,
                subject: draft.subject,
                machineName: draft.machineName || '',
                insertLabel,
                body: draft.body,
                wrapAt: draft.wrapAt,
                updatedAt: new Date().toISOString()
            };
        },

        getUniqueOutlookAssistTemplateTitle(baseTitle, ignoreId = '') {
            const base = String(baseTitle || TXT.unnamed).trim() || TXT.unnamed;
            const used = new Set(this.getOutlookAssistState().templates.filter(t => t.id !== ignoreId).map(t => t.title));
            if (!used.has(base)) return base;
            let index = 2;
            let candidate = `${base}${TXT.duplicateSuffix}`;
            while (used.has(candidate)) {
                candidate = `${base}${TXT.duplicateSuffix}${index}`;
                index += 1;
            }
            return candidate;
        },

        saveOutlookAssistTemplate(mode = 'normal', options = {}) {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const draft = this.getCurrentOutlookAssistDraft();
            this.recordOutlookAssistInsertHistory(draft.machineName);
            const title = (document.getElementById('outlook-template-title')?.value || draft.subject || '').trim();
            if (!title) return this.showToast(TXT.titleRequired, 'warning');
            const category = document.getElementById('outlook-template-category')?.value || 'other';
            const insertLabel = (document.getElementById('outlook-template-insert-label')?.value || this.getOutlookAssistInsertLabel() || TXT.machine).trim();
            const editing = this.getOutlookAssistEditingTemplate();
            const editingId = editing?.id || '';
            let existing = null;
            let finalTitle = title;
            if (mode === 'overwrite' && editing) {
                existing = editing;
                if (!options.skipOverwriteConfirm && !confirm(`\u4e0a\u66f8\u304d\u4fdd\u5b58\u5148\n\n\u300c${title}\u300d\n\n\u3053\u306e\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u4e0a\u66f8\u304d\u3057\u307e\u3059\u304b\uff1f`)) return;
                const sameTitleOther = state.templates.find(t => t.id !== editingId && t.title === title);
                if (sameTitleOther && !confirm(`${TXT.templateOverwriteAskA}${title}${TXT.templateOverwriteAskB}`)) return;
            } else if (mode === 'copy' && editing) {
                finalTitle = this.getUniqueOutlookAssistTemplateTitle(title);
            } else {
                existing = state.templates.find(t => t.title === title);
                if (existing && !confirm(`${TXT.templateOverwriteAskA}${title}${TXT.templateOverwriteAskB}`)) return;
            }
            const cardColor = normalizeOutlookAssistTemplateColor(existing?.cardColor || editing?.cardColor || '');
            const record = this.buildOutlookAssistTemplateRecord(existing, finalTitle, category, insertLabel, cardColor, draft);
            if (existing) Object.assign(existing, record);
            else state.templates.push(record);
            if (editing) {
                this.restoreOutlookAssistDraftAfterTemplateEdit();
                this._outlookAssistEditingTemplateId = '';
            } else if (mode === 'copy') {
                this._outlookAssistEditingTemplateId = '';
            }
            store.save();
            this.renderOutlookAssist();
            this.showToast(`${TXT.templateSavedA}${finalTitle}${TXT.templateSavedB}`, 'success');
        },

        duplicateOutlookAssistTemplate(id) {
            const state = this.getOutlookAssistState();
            const template = state.templates.find(t => t.id === id);
            if (!template) return;
            const copy = {
                ...template,
                id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                title: this.getUniqueOutlookAssistTemplateTitle(`${template.title || TXT.unnamed}${TXT.duplicateSuffix}`),
                favorite: false,
                order: this.getNextOutlookAssistTemplateOrder(),
                updatedAt: new Date().toISOString()
            };
            state.templates.push(copy);
            store.save();
            this.renderOutlookAssistTemplates();
            this.showToast(TXT.templateDuplicated, 'success');
        },

        toggleOutlookAssistTemplateFavorite(id) {
            const template = this.getOutlookAssistState().templates.find(t => t.id === id);
            if (!template) return;
            template.favorite = !template.favorite;
            store.save();
            this.renderOutlookAssistTemplates();
        },

        setOutlookAssistTemplateColor(id, color) {
            const template = this.getOutlookAssistState().templates.find(t => t.id === id);
            if (!template) return;
            const cardColor = normalizeOutlookAssistTemplateColor(color);
            template.cardColor = cardColor;
            template.updatedAt = new Date().toISOString();
            store.save();
            this.renderOutlookAssistTemplates();
        },

        moveOutlookAssistTemplate(id, direction) {
            const state = this.getOutlookAssistState();
            const ordered = this.sortOutlookAssistTemplates(state.templates);
            const index = ordered.findIndex(t => t.id === id);
            const targetIndex = index + (direction < 0 ? -1 : 1);
            if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
            const current = ordered[index];
            const target = ordered[targetIndex];
            const currentOrder = Number(current.order) || index + 1;
            current.order = Number(target.order) || targetIndex + 1;
            target.order = currentOrder;
            store.save();
            this.renderOutlookAssistTemplates();
        },

        applyOutlookAssistTemplate(id) {
            const template = this.getOutlookAssistState().templates.find(t => t.id === id);
            if (!template) return;
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) return;
            const current = this.getCurrentOutlookAssistDraft();
            if (!this.isOutlookAssistDraftBlank(current)) {
                this.openOutlookAssistTemplateApplyChoice(id);
                return;
            }
            this.applyOutlookAssistTemplateToTarget(id, 'current');
        },

        openOutlookAssistTemplateApplyChoice(id) {
            const template = this.getOutlookAssistState().templates.find(t => t.id === id);
            if (!template) return;
            document.getElementById('outlook-template-apply-choice')?.remove();
            const current = this.getCurrentOutlookAssistDraft();
            const machineName = template.machineName || current.machineName || '';
            const previewSubject = this.applyOutlookAssistVariables(template.subject || '', { machineName });
            const previewBody = wrapText(this.applyOutlookAssistVariables(template.body || '', { machineName }), template.wrapAt || current.wrapAt || DEFAULT_WRAP_AT).slice(0, 120);
            const modal = document.createElement('div');
            modal.id = 'outlook-template-apply-choice';
            modal.innerHTML = `
                <div class="outlook-template-apply-backdrop" onclick="app.closeOutlookAssistTemplateApplyChoice()"></div>
                <section class="outlook-template-apply-panel">
                    <button type="button" class="outlook-template-apply-close" onclick="app.closeOutlookAssistTemplateApplyChoice()"><i class="fa-solid fa-xmark"></i></button>
                    <h3>${this.escapeHtml(template.title || TXT.templates)}</h3>
                    <p>${this.escapeHtml(TXT.templateApplyChoice.split('\n')[0])}</p>
                    <div class="outlook-template-apply-preview">
                        <b>${TXT.templatePreview}</b>
                        <span>${TXT.subject}: ${this.escapeHtml(previewSubject || TXT.noSubject)}</span>
                        <pre>${this.escapeHtml(previewBody || TXT.previewNoBody)}</pre>
                    </div>
                    <div class="outlook-template-apply-actions">
                        <button type="button" onclick="app.applyOutlookAssistTemplateToTarget('${this.escapeJs(id)}', 'current')"><i class="fa-solid fa-file-pen"></i> ${TXT.applyCurrentPage}</button>
                        <button type="button" onclick="app.applyOutlookAssistTemplateToTarget('${this.escapeJs(id)}', 'new')"><i class="fa-solid fa-file-circle-plus"></i> ${TXT.applyNewPage}</button>
                        <button type="button" onclick="app.closeOutlookAssistTemplateApplyChoice()">${TXT.cancel}</button>
                    </div>
                </section>
            `;
            document.body.appendChild(modal);
        },

        closeOutlookAssistTemplateApplyChoice() {
            document.getElementById('outlook-template-apply-choice')?.remove();
        },

        applyOutlookAssistTemplateToTarget(id, target = 'current') {
            const template = this.getOutlookAssistState().templates.find(t => t.id === id);
            if (!template) return;
            this.closeOutlookAssistTemplateApplyChoice();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) return;
            const current = this.getCurrentOutlookAssistDraft();
            const applyToNewPage = target === 'new';
            const machineName = template.machineName || current.machineName || '';
            const insertLabel = template.insertLabel || current.insertLabel || TXT.machine;
            template.useCount = Math.max(0, Number(template.useCount) || 0) + 1;
            template.lastUsedAt = new Date().toISOString();
            const appliedDraft = normalizeOutlookAssistDraftRecord({
                ...current,
                pageTitle: current.pageTitle || template.title || '',
                to: template.to || '',
                cc: template.cc || '',
                bcc: template.bcc || '',
                subject: this.applyOutlookAssistVariables(template.subject || '', { machineName }),
                machineName,
                insertLabel,
                body: wrapText(this.applyOutlookAssistVariables(template.body || '', { machineName }), template.wrapAt || current.wrapAt || DEFAULT_WRAP_AT),
                wrapAt: template.wrapAt || current.wrapAt || DEFAULT_WRAP_AT,
                autoWrap: current.autoWrap !== false,
                mergeWrap: !!current.mergeWrap,
                updatedAt: new Date().toISOString()
            });
            if (applyToNewPage) {
                const pages = this.getOutlookAssistDraftPages(worker);
                const index = this.getOutlookAssistDraftPageIndex(worker);
                pages.splice(index + 1, 0, {
                    ...appliedDraft,
                    pageTitle: this.getUniqueOutlookAssistDraftPageTitleExact(template.title || appliedDraft.pageTitle || appliedDraft.subject, pages) || (template.title || '')
                });
                state.draftPagesByWorker[worker] = pages;
                state.draftPageIndexByWorker[worker] = index + 1;
                state.draftsByWorker[worker] = pages[index + 1];
            } else {
                this.setCurrentOutlookAssistDraft(appliedDraft);
            }
            const status = this.getOutlookAssistCopyStatus(worker);
            ['to', 'cc', 'bcc', 'subject', 'body'].forEach(field => { status[field] = false; });
            store.save();
            this.renderOutlookAssist();
            setTimeout(() => document.getElementById('outlook-assist-machine')?.focus(), 0);
            this.showToast(`${TXT.templateSavedA}${template.title || TXT.unnamed}${TXT.templateAppliedB}`, 'success');
        },

        deleteOutlookAssistTemplate(id) {
            const state = this.getOutlookAssistState();
            const index = state.templates.findIndex(t => t.id === id);
            if (index < 0) return;
            const template = state.templates[index];
            if (!confirm(`${TXT.templateDeleteAskA}${template.title || TXT.unnamed}${TXT.templateDeleteAskB}`)) return;
            state.templates.splice(index, 1);
            if (this._outlookAssistEditingTemplateId === id) this._outlookAssistEditingTemplateId = '';
            this._outlookAssistDeletedTemplate = { template, index };
            clearTimeout(this._outlookAssistDeleteUndoTimer);
            this._outlookAssistDeleteUndoTimer = setTimeout(() => {
                this._outlookAssistDeletedTemplate = null;
                this.renderOutlookAssistTemplates();
            }, 8000);
            store.save();
            this.renderOutlookAssistTemplates();
            this.showToast(TXT.templateDeleted, 'info');
        },

        undoDeleteOutlookAssistTemplate() {
            const deleted = this._outlookAssistDeletedTemplate;
            if (!deleted) return;
            const state = this.getOutlookAssistState();
            const index = Math.max(0, Math.min(deleted.index, state.templates.length));
            state.templates.splice(index, 0, deleted.template);
            this._outlookAssistDeletedTemplate = null;
            clearTimeout(this._outlookAssistDeleteUndoTimer);
            store.save();
            this.renderOutlookAssistTemplates();
            this.showToast(TXT.restored, 'success');
        },

        exportOutlookAssistPersonalData() {
            this.saveOutlookAssistDraftFromForm();
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker || '';
            if (!worker) return this.showToast(TXT.personalImportNoWorker, 'warning');
            const includeDraft = document.getElementById('outlook-export-draft')?.checked !== false;
            const includeCopyStatus = document.getElementById('outlook-export-copy-status')?.checked !== false;
            const includeTemplates = !!document.getElementById('outlook-export-templates')?.checked;
            const includeAddressBook = !!document.getElementById('outlook-export-address-book')?.checked;
            state.personalExportOptions = {
                draft: includeDraft,
                copyStatus: includeCopyStatus,
                templates: includeTemplates,
                addressBook: includeAddressBook
            };
            const payload = {
                type: 'outlook_assist_personal_backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                worker,
                includes: { draft: includeDraft, copyStatus: includeCopyStatus, templates: includeTemplates, addressBook: includeAddressBook }
            };
            if (includeDraft) payload.draft = normalizeOutlookAssistDraftRecord(this.getCurrentOutlookAssistDraft());
            if (includeCopyStatus) payload.copyStatus = { ...this.getOutlookAssistCopyStatus(worker) };
            if (includeTemplates) payload.templates = JSON.parse(JSON.stringify(state.templates || []));
            if (includeAddressBook) {
                payload.recipientContacts = JSON.parse(JSON.stringify(state.recipientContacts || []));
                payload.recipientSets = JSON.parse(JSON.stringify(state.recipientSets || []));
                payload.recipientGroupUpdatedAt = { ...(state.recipientGroupUpdatedAt || {}) };
                payload.recipientGroupColors = { ...(state.recipientGroupColors || {}) };
            }
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `outlook_assist_${sanitizeOutlookAssistFileName(worker)}_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            this.showToast(TXT.personalExported, 'success');
        },

        importOutlookAssistPersonalDataFromFile(file) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    this.importOutlookAssistPersonalData(String(reader.result || ''));
                } catch (error) {
                    this.showToast(TXT.personalImportInvalid, 'warning');
                }
            };
            reader.onerror = () => this.showToast(TXT.personalImportInvalid, 'warning');
            reader.readAsText(file, 'utf-8');
        },

        getOutlookAssistPersonalImportPreviewLines(payload, targetWorker) {
            const includes = [];
            if (payload.draft) includes.push(TXT.exportDraft);
            if (payload.copyStatus) includes.push(TXT.exportCopyStatus);
            if (Array.isArray(payload.templates)) includes.push(`${TXT.exportTemplates}:${payload.templates.length}`);
            if (Array.isArray(payload.recipientContacts) || Array.isArray(payload.recipientSets)) includes.push(TXT.exportAddressBook);
            const draft = payload.draft ? normalizeOutlookAssistDraftRecord(payload.draft) : null;
            const body = draft ? normalizePlainText(draft.body || '').slice(0, 50) : '';
            return [
                TXT.importPreviewTitle,
                `${TXT.previewWorker}: ${targetWorker}`,
                `${TXT.previewIncludes}: ${includes.join(', ') || '-'}`,
                `${TXT.to}: ${draft?.to || '-'}`,
                `${TXT.subject}: ${draft?.subject || '-'}`,
                `${TXT.previewBody}: ${body || TXT.previewNoBody}`,
                '',
                TXT.importProceed
            ];
        },

        getOutlookAssistAddressBookImportDiff(payload) {
            const state = this.getOutlookAssistState();
            const existingEmails = new Set((state.recipientContacts || []).map(contact => String(contact.email || '').toLowerCase()).filter(Boolean));
            const existingSetNames = new Set((state.recipientSets || []).map(set => String(set.name || '')).filter(Boolean));
            const contacts = Array.isArray(payload.recipientContacts) ? payload.recipientContacts : [];
            const sets = Array.isArray(payload.recipientSets) ? payload.recipientSets : [];
            let newContacts = 0;
            let updateContacts = 0;
            const groups = new Set();
            contacts.forEach(contact => {
                const email = String(contact?.email || '').trim().toLowerCase();
                const familyName = String(contact?.familyName || '').trim();
                if (!email && !familyName) return;
                if (email && existingEmails.has(email)) updateContacts += 1;
                else newContacts += 1;
                normalizeOutlookAssistGroups(contact?.groups || contact?.group).forEach(group => groups.add(group));
            });
            let newSets = 0;
            let updateSets = 0;
            sets.forEach(set => {
                const name = String(set?.name || '').trim();
                if (name && existingSetNames.has(name)) updateSets += 1;
                else newSets += 1;
            });
            return [
                TXT.addressBookDiffTitle,
                `${TXT.newContacts}: ${newContacts}`,
                `${TXT.updateContacts}: ${updateContacts}`,
                `${TXT.newRecipientSets}: ${newSets}`,
                `${TXT.updateRecipientSets}: ${updateSets}`,
                `${TXT.groups}: ${groups.size}`,
                '',
                TXT.importProceed
            ];
        },

        importOutlookAssistPersonalData(jsonText) {
            const payload = JSON.parse(jsonText);
            if (!payload || payload.type !== 'outlook_assist_personal_backup') {
                this.showToast(TXT.personalImportInvalid, 'warning');
                return;
            }
            const state = this.getOutlookAssistState();
            const fileWorker = String(payload.worker || '').trim();
            const selectedWorker = state.selectedWorker || '';
            const workers = this.getOutlookAssistCoreWorkers();
            let targetWorker = fileWorker && workers.includes(fileWorker) ? fileWorker : selectedWorker;
            if (!targetWorker) {
                this.showToast(TXT.personalImportNoWorker, 'warning');
                return;
            }
            if (fileWorker && fileWorker !== targetWorker) {
                const message = workers.includes(fileWorker)
                    ? `${TXT.personalImportMismatchA}${fileWorker}${TXT.personalImportMismatchB}${targetWorker}${TXT.personalImportMismatchC}`
                    : TXT.personalImportMissingWorker;
                if (!confirm(message)) return;
            }
            if (!confirm(this.getOutlookAssistPersonalImportPreviewLines(payload, targetWorker).join('\n'))) return;
            const hasAddressBookImport = Array.isArray(payload.recipientContacts) || Array.isArray(payload.recipientSets);
            if (hasAddressBookImport && !confirm(this.getOutlookAssistAddressBookImportDiff(payload).join('\n'))) return;
            state.selectedWorker = targetWorker;
            if (payload.draft) {
                const choice = prompt(TXT.importOverwriteChoice, '1');
                if (choice === '3' || choice === null) return;
                if (choice === '2') {
                    this.exportOutlookAssistPersonalBackupForWorker(targetWorker);
                    this.showToast(TXT.draftBackedUp, 'success');
                }
                state.draftsByWorker[targetWorker] = {
                    ...normalizeOutlookAssistDraftRecord(payload.draft),
                    updatedAt: new Date().toISOString()
                };
                const pages = this.getOutlookAssistDraftPages(targetWorker);
                const index = this.getOutlookAssistDraftPageIndex(targetWorker);
                pages[index] = state.draftsByWorker[targetWorker];
                state.draftPagesByWorker[targetWorker] = pages;
            }
            if (payload.copyStatus) {
                const copyStatusKey = this.getOutlookAssistCopyStatusKey(targetWorker);
                if (!state.copyStatus[copyStatusKey] || typeof state.copyStatus[copyStatusKey] !== 'object') state.copyStatus[copyStatusKey] = {};
                state.copyStatus[copyStatusKey] = {
                    to: !!payload.copyStatus?.to,
                    cc: !!payload.copyStatus?.cc,
                    bcc: !!payload.copyStatus?.bcc,
                    subject: !!payload.copyStatus?.subject,
                    body: !!payload.copyStatus?.body
                };
            }
            if (Array.isArray(payload.templates)) this.mergeOutlookAssistImportedTemplates(payload.templates);
            if (hasAddressBookImport) this.importOutlookAssistAddressBookPayload(payload);
            store.save();
            this.renderOutlookAssist();
            this.showToast(TXT.personalImported, 'success');
        },

        exportOutlookAssistPersonalBackupForWorker(worker) {
            const state = this.getOutlookAssistState();
            const payload = {
                type: 'outlook_assist_personal_backup',
                version: 1,
                exportedAt: new Date().toISOString(),
                worker,
                includes: { draft: true, copyStatus: true, templates: false, addressBook: false },
                draft: normalizeOutlookAssistDraftRecord(state.draftsByWorker[worker] || {}),
                copyStatus: { ...(state.copyStatus?.[worker] || {}) }
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `outlook_assist_backup_${sanitizeOutlookAssistFileName(worker)}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        },

        mergeOutlookAssistImportedTemplates(templates = []) {
            const state = this.getOutlookAssistState();
            templates.forEach(template => {
                if (!template || typeof template !== 'object') return;
                const title = String(template.title || '').trim();
                if (!title) return;
                const existing = state.templates.find(item => item.title === title);
                const record = {
                    ...template,
                    id: existing?.id || template.id || `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    title,
                    category: this.getOutlookAssistTemplateCategoryId(template.category || 'other'),
                    cardColor: normalizeOutlookAssistTemplateColor(template.cardColor),
                    favorite: !!template.favorite,
                    useCount: Math.max(0, Number(template.useCount) || 0),
                    lastUsedAt: String(template.lastUsedAt || ''),
                    order: existing?.order ?? template.order ?? this.getNextOutlookAssistTemplateOrder(),
                    updatedAt: new Date().toISOString()
                };
                if (existing) Object.assign(existing, record);
                else state.templates.push(record);
            });
        },

        importOutlookAssistAddressBookPayload(payload) {
            const state = this.getOutlookAssistState();
            if (Array.isArray(payload.recipientContacts)) {
                payload.recipientContacts.forEach(contact => {
                    const email = String(contact?.email || '').trim();
                    const familyName = String(contact?.familyName || '').trim();
                    if (!email && !familyName) return;
                    const groups = normalizeOutlookAssistGroups(contact.groups || contact.group);
                    const existing = email ? state.recipientContacts.find(item => String(item.email || '').toLowerCase() === email.toLowerCase()) : null;
                    const record = {
                        id: existing?.id || contact.id || `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        familyName,
                        givenName: String(contact.givenName || '').trim(),
                        email,
                        group: groups[0] || '',
                        groups,
                        note: String(contact.note || '').trim(),
                        updatedAt: new Date().toISOString()
                    };
                    if (existing) Object.assign(existing, record);
                    else state.recipientContacts.push(record);
                });
            }
            if (Array.isArray(payload.recipientSets)) {
                payload.recipientSets.forEach(set => {
                    const name = String(set?.name || '').trim();
                    if (!name) return;
                    const existing = state.recipientSets.find(item => item.name === name);
                    const record = {
                        id: existing?.id || set.id || `rcpt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                        name,
                        to: String(set.to || ''),
                        cc: String(set.cc || ''),
                        bcc: String(set.bcc || ''),
                        updatedAt: new Date().toISOString()
                    };
                    if (existing) Object.assign(existing, record);
                    else state.recipientSets.push(record);
                });
            }
            if (payload.recipientGroupUpdatedAt && typeof payload.recipientGroupUpdatedAt === 'object') {
                state.recipientGroupUpdatedAt = { ...state.recipientGroupUpdatedAt, ...payload.recipientGroupUpdatedAt };
            }
            if (payload.recipientGroupColors && typeof payload.recipientGroupColors === 'object') {
                Object.entries(payload.recipientGroupColors).forEach(([group, color]) => {
                    const groupName = String(group || '').trim();
                    if (!groupName) return;
                    state.recipientGroupColors[groupName] = normalizeOutlookAssistTemplateColor(color);
                });
            }
            this.showToast(TXT.addressBookImported, 'success');
        },

        clearOutlookAssistDraft() {
            const state = this.getOutlookAssistState();
            const worker = state.selectedWorker;
            if (!worker) return;
            if (!confirm(`${worker}${TXT.draftClearAsk}`)) return;
            this.setCurrentOutlookAssistDraft(createEmptyDraft());
            store.save();
            this.renderOutlookAssist();
        }
    });

    const originalSaveOutlookAssistDraftFromForm = MaintenanceApp.prototype.saveOutlookAssistDraftFromForm;
    MaintenanceApp.prototype.saveOutlookAssistDraftFromForm = function (...args) {
        const state = this.getOutlookAssistState();
        const worker = state.selectedWorker || '';
        const previousMergeWrap = !!state.draftsByWorker?.[worker]?.mergeWrap;
        const previousRecipients = worker && state.draftsByWorker?.[worker] ? {
            to: state.draftsByWorker[worker].to || '',
            cc: state.draftsByWorker[worker].cc || '',
            bcc: state.draftsByWorker[worker].bcc || ''
        } : {};
        const restoredRecipientInputs = [];
        ['to', 'cc', 'bcc'].forEach(field => {
            const input = document.getElementById(`outlook-assist-${field}`);
            const base = input?.dataset.baseRecipients || previousRecipients[field] || '';
            const hasBase = this.splitOutlookAssistRecipients(base).length > 0;
            if (input && hasBase && !String(input.value || '').trim()) {
                restoredRecipientInputs.push({ input, value: input.value });
                input.value = base;
            }
        });
        const checkbox = document.getElementById('outlook-assist-merge-wrap');
        const currentMergeWrap = checkbox ? !!checkbox.checked : previousMergeWrap;
        const result = originalSaveOutlookAssistDraftFromForm.apply(this, args);
        restoredRecipientInputs.forEach(item => { item.input.value = item.value; });
        if (worker && state.draftsByWorker?.[worker]) {
            state.draftsByWorker[worker].mergeWrap = currentMergeWrap;
            ['to', 'cc', 'bcc'].forEach(field => {
                const input = document.getElementById(`outlook-assist-${field}`);
                const hadRecipients = this.splitOutlookAssistRecipients(previousRecipients[field] || '').length > 0;
                if (input && hadRecipients && !String(input.value || '').trim()) {
                    state.draftsByWorker[worker][field] = previousRecipients[field] || '';
                }
            });
    }
    return result;
};

MaintenanceApp.prototype.resolveOutlookAssistRecipientItem = function (value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const normalized = MaintenanceApp.toHalfWidthLower(text);
    const contacts = this.getOutlookAssistState().recipientContacts || [];
    const emailMatch = contacts.find(contact => MaintenanceApp.toHalfWidthLower(contact.email || '') === normalized);
    if (emailMatch?.email) return emailMatch.email;
    const nameMatches = contacts.filter(contact => {
        const familyName = MaintenanceApp.toHalfWidthLower(contact.familyName || '');
        const fullName = MaintenanceApp.toHalfWidthLower(this.getOutlookAssistContactName(contact));
        return familyName === normalized || fullName === normalized;
    });
    return nameMatches.length === 1 && nameMatches[0].email ? nameMatches[0].email : text;
};

MaintenanceApp.prototype.normalizeOutlookAssistRecipientItems = function (items) {
    const unique = [];
    const seen = new Set();
    (items || []).forEach(item => {
        const resolved = this.resolveOutlookAssistRecipientItem(item);
        const key = MaintenanceApp.toHalfWidthLower(resolved);
        if (!key || seen.has(key)) return;
        seen.add(key);
        unique.push(resolved);
    });
    return unique;
};

MaintenanceApp.prototype.commitOutlookAssistRecipientField = function (field, shouldRender = true) {
    const input = document.getElementById(`outlook-assist-${field}`);
    if (!input) return;
    const state = this.getOutlookAssistState();
    const worker = state.selectedWorker || '';
    if (!worker) return;
    const draft = this.getCurrentOutlookAssistDraft();
    const base = input.dataset.baseRecipients || draft[field] || '';
    const added = input.value || '';
    const unique = this.normalizeOutlookAssistRecipientItems([
        ...this.splitOutlookAssistRecipients(base),
        ...this.splitOutlookAssistRecipients(added)
    ]);
    this.setCurrentOutlookAssistDraft({
        ...draft,
        [field]: unique.join('; '),
        updatedAt: new Date().toISOString()
    });
    store.save();
    input.value = '';
    input.dataset.baseRecipients = unique.join('; ');
    if (shouldRender) {
        this.renderOutlookAssist();
        return;
    }
    this.renderOutlookAssistPreview();
    this.renderOutlookAssistCopyChecklist();
    this.renderOutlookAssistAssistPanels();
};

MaintenanceApp.prototype.handleOutlookAssistRecipientKeydown = function (event, field) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.commitOutlookAssistRecipientField(field, true);
};

document.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    const input = event.target?.closest?.('#outlook-assist-to, #outlook-assist-cc, #outlook-assist-bcc');
    const outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!input || !outlookApp?.handleOutlookAssistRecipientKeydown) return;
    const field = input.id.replace('outlook-assist-', '');
    outlookApp.handleOutlookAssistRecipientKeydown(event, field);
});

const removeOutlookAssistRecipientDelimiterHelp = () => {
    const targetText = '\u5b9b\u5148\u30fb\u4eba\u540d\u306e\u533a\u5207\u308a\u306f\u300c;\u300d\u307e\u305f\u306f\u300c,\u300d\u3092\u4f7f\u3063\u3066\u304f\u3060\u3055\u3044\u3002\u30b9\u30da\u30fc\u30b9\u533a\u5207\u308a\u306f\u4f7f\u308f\u306a\u3044\u3067\u304f\u3060\u3055\u3044\u3002';
    document.querySelectorAll('p, small, .outlook-recipient-help').forEach(element => {
        const text = String(element.textContent || '').trim();
        if (text === targetText || (element.classList.contains('outlook-recipient-help') && text.includes(targetText))) {
            element.remove();
        }
    });
};

document.addEventListener('DOMContentLoaded', removeOutlookAssistRecipientDelimiterHelp);
new MutationObserver(removeOutlookAssistRecipientDelimiterHelp).observe(document.documentElement, {
    childList: true,
    subtree: true
});

const outlookAssistRecipientChipStyle = document.createElement('style');
outlookAssistRecipientChipStyle.textContent = `
    .outlook-recipient-chip {
        background: #fff4d6 !important;
        border-color: #f59e0b !important;
        color: #7c2d12 !important;
        box-shadow: 0 1px 0 rgba(245, 158, 11, 0.18) !important;
    }
    .outlook-recipient-chip button {
        background: #fde68a !important;
        color: #7c2d12 !important;
    }
    .outlook-recipient-chip button:hover {
        background: #fbbf24 !important;
        color: #451a03 !important;
    }
`;
document.head.appendChild(outlookAssistRecipientChipStyle);

const OUTLOOK_ASSIST_GROUP_COLOR_KEY = 'outlookAssistGroupColors';

const getOutlookAssistGroupColors = () => {
    try {
        return JSON.parse(localStorage.getItem(OUTLOOK_ASSIST_GROUP_COLOR_KEY) || '{}') || {};
    } catch (error) {
        return {};
    }
};

const saveOutlookAssistGroupColors = colors => {
    localStorage.setItem(OUTLOOK_ASSIST_GROUP_COLOR_KEY, JSON.stringify(colors || {}));
};

const getReadableOutlookAssistGroupTextColor = color => {
    const hex = String(color || '').replace('#', '');
    if (hex.length !== 6) return '#0f172a';
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) > 150 ? '#0f172a' : '#ffffff';
};

const tintOutlookAssistGroupColor = color => {
    const hex = String(color || '').replace('#', '');
    if (hex.length !== 6) return '#eaf6ff';
    const mix = value => Math.round(parseInt(value, 16) * 0.18 + 255 * 0.82).toString(16).padStart(2, '0');
    return `#${mix(hex.slice(0, 2))}${mix(hex.slice(2, 4))}${mix(hex.slice(4, 6))}`;
};

const getOutlookAssistGroupCardName = card => {
    const clone = card.cloneNode(true);
    clone.querySelectorAll('button, input, .outlook-group-color-control').forEach(node => node.remove());
    const lines = String(clone.textContent || '').split(/\n+/).map(line => line.trim()).filter(Boolean);
    return lines.find(line => !line.includes('最終更新') && !line.includes('所属') && !line.includes('@')) || '';
};

const applyOutlookAssistGroupCardColor = (card, groupName, color) => {
    if (!card || !groupName) return;
    if (!color) {
        card.style.removeProperty('background');
        card.style.removeProperty('border-color');
        card.style.removeProperty('color');
        return;
    }
    const textColor = getReadableOutlookAssistGroupTextColor(color);
    card.style.setProperty('background', tintOutlookAssistGroupColor(color), 'important');
    card.style.setProperty('border-color', color, 'important');
    card.style.setProperty('color', textColor === '#ffffff' ? '#0f172a' : textColor, 'important');
};

const enhanceOutlookAssistGroupColorControls = () => {
    const colors = getOutlookAssistGroupColors();
    document.querySelectorAll('button').forEach(button => {
        if (!String(button.textContent || '').includes('グループ一括追加')) return;
        const card = button.closest('article, li, section, .card, [class*="card"], [class*="group"]') || button.parentElement;
        if (!card || card.dataset.outlookGroupColorReady === '1') return;
        const groupName = getOutlookAssistGroupCardName(card);
        if (!groupName) return;
        card.dataset.outlookGroupColorReady = '1';
        applyOutlookAssistGroupCardColor(card, groupName, colors[groupName]);

        const control = document.createElement('label');
        control.className = 'outlook-group-color-control';
        control.title = 'グループの色を変更';
        control.innerHTML = '<i class="fa-solid fa-palette"></i><input type="color" aria-label="グループの色">';
        const input = control.querySelector('input');
        input.value = colors[groupName] || '#eaf6ff';
        input.addEventListener('input', event => {
            const nextColors = getOutlookAssistGroupColors();
            nextColors[groupName] = event.target.value;
            saveOutlookAssistGroupColors(nextColors);
            applyOutlookAssistGroupCardColor(card, groupName, event.target.value);
        });
        button.insertAdjacentElement('afterend', control);
    });
};

const outlookAssistGroupColorStyle = document.createElement('style');
outlookAssistGroupColorStyle.textContent = `
    .outlook-group-color-control {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 44px;
        margin-left: 8px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #ffffff;
        color: #0f172a;
        cursor: pointer;
        vertical-align: middle;
    }
    .outlook-group-color-control input {
        width: 0;
        height: 0;
        opacity: 0;
        position: absolute;
        pointer-events: none;
    }
    .outlook-group-color-control:hover {
        border-color: #f59e0b;
        color: #c2410c;
    }
`;
document.head.appendChild(outlookAssistGroupColorStyle);

document.addEventListener('DOMContentLoaded', enhanceOutlookAssistGroupColorControls);
new MutationObserver(enhanceOutlookAssistGroupColorControls).observe(document.documentElement, {
    childList: true,
    subtree: true
});

MaintenanceApp.prototype.appendOutlookAssistEmailsToField = function (field, emails) {
    if (!['to', 'cc', 'bcc'].includes(field)) return;
    if (typeof this.saveOutlookAssistDraftFromForm === 'function') {
        this.saveOutlookAssistDraftFromForm();
    }
    const state = this.getOutlookAssistState();
    const worker = state.selectedWorker || '';
    if (!worker) return;
    const draft = this.getCurrentOutlookAssistDraft();
    const input = document.getElementById(`outlook-assist-${field}`);
    const pendingItems = input ? [
        ...this.splitOutlookAssistRecipients(input.dataset.baseRecipients || ''),
        ...this.splitOutlookAssistRecipients(input.value || '')
    ] : [];
    const addedItems = (Array.isArray(emails) ? emails : this.splitOutlookAssistRecipients(emails))
        .map(item => {
            if (typeof item === 'string') return item;
            return item?.email || item?.value || '';
        })
        .filter(Boolean);
    const normalize = this.normalizeOutlookAssistRecipientItems
        ? items => this.normalizeOutlookAssistRecipientItems(items)
        : items => {
            const unique = [];
            const seen = new Set();
            (items || []).forEach(item => {
                const key = String(item || '').trim().toLowerCase();
                if (!key || seen.has(key)) return;
                seen.add(key);
                unique.push(String(item || '').trim());
            });
            return unique;
        };
    const merged = normalize([
        ...this.splitOutlookAssistRecipients(draft[field] || ''),
        ...pendingItems,
        ...addedItems
    ]);
    this.setCurrentOutlookAssistDraft({
        ...draft,
        [field]: merged.join('; '),
        updatedAt: new Date().toISOString()
    });
    store.save();
    if (input) {
        input.value = '';
        input.dataset.baseRecipients = merged.join('; ');
    }
    this.renderOutlookAssist();
};

document.addEventListener('pointerdown', event => {
    const button = event.target?.closest?.('.outlook-recipient-select');
    if (!button) return;
    const outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!outlookApp?.openOutlookAssistRecipientPicker) return;
    const onclick = String(button.getAttribute('onclick') || '');
    const match = onclick.match(/openOutlookAssistRecipientPicker\('([^']+)'\)/);
    const field = match?.[1];
    if (!['to', 'cc', 'bcc'].includes(field)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    outlookApp.openOutlookAssistRecipientPicker(field);
}, true);

MaintenanceApp.prototype.parseOutlookAssistNameEmailEntries = function (value) {
    const text = String(value || '').replace(/\r\n?/g, '\n');
    const entries = [];
    const nameEmailPattern = /([^<>\n;,]+?)\s*<\s*([^<>\s;,]+@[^<>\s;,]+)\s*>/g;
    let match;
    let lastIndex = 0;
    while ((match = nameEmailPattern.exec(text)) !== null) {
        entries.push({
            displayName: String(match[1] || '').trim(),
            email: String(match[2] || '').trim()
        });
        lastIndex = nameEmailPattern.lastIndex;
    }
    const remainder = text.slice(lastIndex);
    remainder.split(/[;,\n]+/).map(item => item.trim()).filter(Boolean).forEach(item => {
        const emailMatch = item.match(/[^\s<>;,]+@[^\s<>;,]+/);
        if (emailMatch) {
            entries.push({
                displayName: item.replace(emailMatch[0], '').replace(/[<>]/g, '').trim(),
                email: emailMatch[0].trim()
            });
        } else {
            entries.push({
                displayName: item,
                email: ''
            });
        }
    });
    return entries;
};

MaintenanceApp.prototype.splitOutlookAssistRecipients = function (value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const parsed = this.parseOutlookAssistNameEmailEntries(text);
    if (parsed.some(entry => entry.email)) {
        return parsed.map(entry => entry.email || entry.displayName).filter(Boolean);
    }
    return text.split(/[;,\n]+/).map(item => item.trim()).filter(Boolean);
};

MaintenanceApp.prototype.bulkRegisterOutlookAssistNameEmailGroup = function () {
    const groupName = prompt('登録するグループ名を入力してください');
    if (!groupName) return;
    const pasted = prompt('Outlookからコピーした「名前 <メールアドレス>」を貼り付けてください。複数件まとめて貼り付けできます。');
    if (!pasted) return;
    const entries = this.parseOutlookAssistNameEmailEntries(pasted).filter(entry => entry.email);
    if (!entries.length) {
        alert('メールアドレスを読み取れませんでした。例: 山田 太郎 <taro@example.com>');
        return;
    }
    const state = this.getOutlookAssistState();
    const contacts = state.recipientContacts || [];
    const group = String(groupName || '').trim();
    entries.forEach(entry => {
        const emailKey = MaintenanceApp.toHalfWidthLower(entry.email);
        const existing = contacts.find(contact => MaintenanceApp.toHalfWidthLower(contact.email || '') === emailKey);
        const nameParts = String(entry.displayName || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
        const familyName = nameParts[0] || entry.displayName || entry.email;
        const givenName = nameParts.slice(1).join(' ');
        if (existing) {
            existing.familyName = existing.familyName || familyName;
            existing.givenName = existing.givenName || givenName;
            const groups = Array.isArray(existing.groups)
                ? existing.groups
                : String(existing.group || '').split(/[;,、\n]+/).map(item => item.trim()).filter(Boolean);
            if (!groups.includes(group) && groups.length < 7) groups.push(group);
            existing.groups = groups;
            existing.group = groups.join(', ');
            existing.updatedAt = new Date().toISOString();
            return;
        }
        contacts.push({
            id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            familyName,
            givenName,
            email: entry.email,
            groups: [group],
            group,
            note: '',
            updatedAt: new Date().toISOString()
        });
    });
    state.recipientContacts = contacts;
    store.save();
    alert(`${entries.length}件を「${group}」に登録しました。`);
    if (typeof this.renderOutlookAssist === 'function') {
        this.renderOutlookAssist();
    }
};

const enhanceOutlookAssistBulkNameEmailImport = () => {
    const outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!outlookApp?.bulkRegisterOutlookAssistNameEmailGroup) return;
    document.querySelectorAll('button').forEach(button => {
        if (!String(button.textContent || '').includes('宛先管理')) return;
        const area = button.parentElement;
        if (!area || area.querySelector('.outlook-bulk-name-email-import')) return;
        const importButton = document.createElement('button');
        importButton.type = 'button';
        importButton.className = 'outlook-bulk-name-email-import';
        importButton.innerHTML = '<i class="fa-solid fa-address-book"></i> 名前メール一括登録';
        importButton.addEventListener('click', () => outlookApp.bulkRegisterOutlookAssistNameEmailGroup());
        button.insertAdjacentElement('afterend', importButton);
    });
};

const outlookAssistBulkNameEmailImportStyle = document.createElement('style');
outlookAssistBulkNameEmailImportStyle.textContent = `
    .outlook-bulk-name-email-import {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        padding: 6px 13px;
        margin-left: 4px;
        border: 1px solid #f59e0b;
        border-radius: 12px;
        background: #fff7ed;
        color: #c2410c;
        font-size: 0.78rem;
        line-height: 1.12;
        font-weight: 800;
        cursor: pointer;
    }
    .outlook-bulk-name-email-import:hover {
        background: #fed7aa;
        color: #7c2d12;
    }
`;
document.head.appendChild(outlookAssistBulkNameEmailImportStyle);
document.addEventListener('DOMContentLoaded', enhanceOutlookAssistBulkNameEmailImport);
new MutationObserver(enhanceOutlookAssistBulkNameEmailImport).observe(document.documentElement, {
    childList: true,
    subtree: true
});

const OUTLOOK_ASSIST_DATE_FORMAT_KEY = 'outlookAssistDateFormat';
const getOutlookAssistDateFormat = () => localStorage.getItem(OUTLOOK_ASSIST_DATE_FORMAT_KEY) || 'slash';
const formatOutlookAssistDateByPreference = (month, day) => {
    const m = Number(month);
    const d = Number(day);
    const format = getOutlookAssistDateFormat();
    if (!m || !d) return `${month}/${day}`;
    if (format === 'jp') return `${m}月${d}日`;
    if (format === 'weekday') {
        const now = new Date();
        const date = new Date(now.getFullYear(), m - 1, d);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return `${m}/${d}(${weekdays[date.getDay()]})`;
    }
    return `${m}/${d}`;
};
const normalizeOutlookAssistPreferredDateText = value => String(value || '')
    .replace(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\([日月火水木金土]\))?\b/g, (_, month, day) => formatOutlookAssistDateByPreference(month, day))
    .replace(/\b(0?[1-9]|1[0-2])月(0?[1-9]|[12]\d|3[01])日\b/g, (_, month, day) => formatOutlookAssistDateByPreference(month, day));

const normalizeOutlookAssistPreferredDateNow = () => {
    return;
    document.querySelectorAll('input, textarea').forEach(field => {
        const id = String(field.id || '');
        const area = field.closest?.('[data-view="outlook-assist"], .outlook-assist, [class*="outlook"]');
        if (!id.includes('outlook-assist') && !area) return;
        const current = field.value;
        const normalized = normalizeOutlookAssistPreferredDateText(current);
        if (current !== normalized) field.value = normalized;
    });
    document.querySelectorAll('[class*="outlook"], [id*="outlook"]').forEach(element => {
        if (element.children.length || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) return;
        const current = element.textContent;
        const normalized = normalizeOutlookAssistPreferredDateText(current);
        if (current !== normalized) element.textContent = normalized;
    });
};

const getOutlookAssistRecipientDuplicateSummary = outlookApp => {
    if (!outlookApp?.getCurrentOutlookAssistDraft || !outlookApp?.splitOutlookAssistRecipients) return [];
    const draft = outlookApp.getCurrentOutlookAssistDraft();
    const labels = { to: '宛先', cc: 'CC', bcc: 'BCC' };
    const contacts = outlookApp.getOutlookAssistState?.().recipientContacts || [];
    const contactByEmail = new Map(contacts.map(contact => [MaintenanceApp.toHalfWidthLower(contact.email || ''), contact]));
    const bucket = new Map();
    ['to', 'cc', 'bcc'].forEach(field => {
        outlookApp.splitOutlookAssistRecipients(draft[field] || '').forEach(item => {
            const key = MaintenanceApp.toHalfWidthLower(item);
            if (!key) return;
            const contact = contactByEmail.get(key);
            const name = contact ? (contact.familyName || outlookApp.getOutlookAssistContactName(contact)) : item;
            if (!bucket.has(key)) bucket.set(key, { name, fields: [] });
            bucket.get(key).fields.push(labels[field]);
        });
    });
    return [...bucket.values()].filter(item => new Set(item.fields).size > 1 || item.fields.length > 1);
};

const enhanceOutlookAssistDuplicateWarning = () => {
    const outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!outlookApp) return;
    const copyButton = [...document.querySelectorAll('button')].find(button => String(button.textContent || '').includes('全文コピー'));
    const anchor = copyButton?.closest?.('[class*="outlook"]') || copyButton?.parentElement;
    if (!anchor) return;
    let panel = document.getElementById('outlook-assist-duplicate-detail');
    const duplicates = getOutlookAssistRecipientDuplicateSummary(outlookApp);
    if (!duplicates.length) {
        panel?.remove();
        return;
    }
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'outlook-assist-duplicate-detail';
        anchor.insertAdjacentElement('afterend', panel);
    }
    panel.innerHTML = `<strong><i class="fa-solid fa-triangle-exclamation"></i> 宛先重複</strong>${duplicates.map(item => `<span>${item.name}: ${[...new Set(item.fields)].join(' / ')}</span>`).join('')}`;
};

const enhanceOutlookAssistDateFormatControl = () => {
    const insertArea = [...document.querySelectorAll('button')].find(button => String(button.textContent || '').includes('本文を大きく'))?.parentElement;
    if (!insertArea || insertArea.querySelector('.outlook-date-format-control')) return;
    const control = document.createElement('label');
    control.className = 'outlook-date-format-control';
    control.innerHTML = `<i class="fa-solid fa-calendar-day"></i><select aria-label="日付形式">
        <option value="slash">7/14</option>
        <option value="jp">7月14日</option>
        <option value="weekday">7/14(火)</option>
    </select>`;
    const select = control.querySelector('select');
    select.value = getOutlookAssistDateFormat();
    select.addEventListener('change', event => {
        localStorage.setItem(OUTLOOK_ASSIST_DATE_FORMAT_KEY, event.target.value);
        normalizeOutlookAssistPreferredDateNow();
        const outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
        outlookApp?.renderOutlookAssistPreview?.();
    });
    insertArea.appendChild(control);
};

MaintenanceApp.prototype.openOutlookAssistBulkNameEmailImportDialog = function () {
    document.getElementById('outlook-bulk-name-email-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'outlook-bulk-name-email-modal';
    modal.className = 'is-open';
    modal.innerHTML = `
        <div class="outlook-bulk-modal-backdrop"></div>
        <section class="outlook-bulk-modal-panel">
            <button type="button" class="outlook-bulk-modal-close" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
            <h2>名前メール一括登録</h2>
            <label>グループ名<input id="outlook-bulk-group-name" placeholder="例: プラント"></label>
            <label>Outlookからコピーした宛先<textarea id="outlook-bulk-name-email-text" placeholder="山田 太郎 <taro@example.com>"></textarea></label>
            <div class="outlook-bulk-modal-actions">
                <button type="button" id="outlook-bulk-preview-button"><i class="fa-solid fa-eye"></i> プレビュー</button>
                <button type="button" id="outlook-bulk-register-button"><i class="fa-solid fa-address-book"></i> 登録</button>
            </div>
            <div id="outlook-bulk-name-email-preview">貼り付け後にプレビューできます。</div>
        </section>`;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.outlook-bulk-modal-backdrop').addEventListener('click', close);
    modal.querySelector('.outlook-bulk-modal-close').addEventListener('click', close);
    const renderPreview = () => {
        const entries = this.parseOutlookAssistNameEmailEntries(modal.querySelector('#outlook-bulk-name-email-text').value).filter(entry => entry.email);
        modal.querySelector('#outlook-bulk-name-email-preview').innerHTML = entries.length
            ? entries.map(entry => `<div><b>${this.escapeHtml(entry.displayName || entry.email)}</b><span>${this.escapeHtml(entry.email)}</span></div>`).join('')
            : 'メールアドレスを読み取れませんでした。';
        return entries;
    };
    modal.querySelector('#outlook-bulk-preview-button').addEventListener('click', renderPreview);
    modal.querySelector('#outlook-bulk-register-button').addEventListener('click', () => {
        const group = modal.querySelector('#outlook-bulk-group-name').value.trim();
        const entries = renderPreview();
        if (!group) {
            alert('グループ名を入力してください。');
            return;
        }
        if (!entries.length) return;
        const state = this.getOutlookAssistState();
        const contacts = state.recipientContacts || [];
        entries.forEach(entry => {
            const emailKey = MaintenanceApp.toHalfWidthLower(entry.email);
            const existing = contacts.find(contact => MaintenanceApp.toHalfWidthLower(contact.email || '') === emailKey);
            const nameParts = String(entry.displayName || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
            const familyName = nameParts[0] || entry.email;
            const givenName = nameParts.slice(1).join(' ');
            if (existing) {
                const groups = Array.isArray(existing.groups) ? existing.groups : String(existing.group || '').split(/[;,、\n]+/).map(item => item.trim()).filter(Boolean);
                if (!groups.includes(group) && groups.length < 7) groups.push(group);
                existing.groups = groups;
                existing.group = groups.join(', ');
                existing.updatedAt = new Date().toISOString();
            } else {
                contacts.push({ id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, familyName, givenName, email: entry.email, groups: [group], group, note: '', updatedAt: new Date().toISOString() });
            }
        });
        state.recipientContacts = contacts;
        store.save();
        close();
        this.renderOutlookAssist?.();
    });
};

MaintenanceApp.prototype.bulkRegisterOutlookAssistNameEmailGroup = function () {
    this.openOutlookAssistBulkNameEmailImportDialog();
};

const enhanceOutlookAssistChecklistToggle = () => {
    return;
    const panel = [...document.querySelectorAll('[class*="outlook"], div, section')].find(element => String(element.textContent || '').includes('宛先チェック') && !element.querySelector?.('.outlook-checklist-toggle'));
    if (!panel) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'outlook-checklist-toggle';
    button.innerHTML = '<i class="fa-solid fa-list-check"></i> チェック表示';
    button.addEventListener('click', () => panel.classList.toggle('outlook-checklist-collapsed'));
    panel.insertAdjacentElement('afterbegin', button);
    panel.classList.add('outlook-checklist-collapsed');
};

const enhanceOutlookAssistTemplateSearch = () => {
    const search = [...document.querySelectorAll('input')].find(input => String(input.placeholder || '').includes('テンプレート検索'));
    if (!search || search.dataset.outlookEnhancedSearch === '1') return;
    search.dataset.outlookEnhancedSearch = '1';
    search.placeholder = 'テンプレート検索（題名・分類・本文）';
    search.addEventListener('input', () => {
        const query = MaintenanceApp.toHalfWidthLower(search.value || '');
        document.querySelectorAll('[class*="template"]').forEach(card => {
            if (card === search || card.contains(search)) return;
            const text = MaintenanceApp.toHalfWidthLower(card.textContent || '');
            card.style.display = !query || text.includes(query) ? '' : 'none';
        });
    });
};

const outlookAssistEnhancementStyle = document.createElement('style');
outlookAssistEnhancementStyle.textContent = `
    #outlook-assist-duplicate-detail {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        margin: 8px 0;
        border: 1px solid #f59e0b;
        border-radius: 10px;
        background: #fff7ed;
        color: #9a3412;
        font-weight: 800;
    }
    #outlook-assist-duplicate-detail span {
        padding: 4px 8px;
        border-radius: 999px;
        background: #ffedd5;
    }
    .outlook-date-format-control {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 40px;
        padding: 0 10px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #ffffff;
        color: #0f172a;
        font-weight: 800;
    }
    .outlook-date-format-control select {
        border: 0;
        background: transparent;
        font-weight: 800;
    }
    #outlook-bulk-name-email-modal {
        position: fixed;
        inset: 0;
        z-index: 99999;
    }
    .outlook-bulk-modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.42);
    }
    .outlook-bulk-modal-panel {
        position: absolute;
        top: 50%;
        left: 50%;
        width: min(720px, calc(100vw - 32px));
        max-height: calc(100vh - 48px);
        overflow: auto;
        transform: translate(-50%, -50%);
        padding: 20px;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.22);
    }
    .outlook-bulk-modal-panel label {
        display: grid;
        gap: 6px;
        margin: 12px 0;
        font-weight: 800;
    }
    .outlook-bulk-modal-panel input,
    .outlook-bulk-modal-panel textarea {
        width: 100%;
        border: 1px solid #bfdbfe;
        border-radius: 10px;
        background: #eff6ff;
        padding: 10px 12px;
        font: inherit;
    }
    .outlook-bulk-modal-panel textarea {
        min-height: 160px;
        resize: vertical;
    }
    .outlook-bulk-modal-close {
        float: right;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid #cbd5e1;
        background: #ffffff;
    }
    .outlook-bulk-modal-actions {
        display: flex;
        gap: 10px;
        margin: 12px 0;
    }
    .outlook-bulk-modal-actions button {
        min-height: 44px;
        padding: 0 16px;
        border-radius: 12px;
        border: 1px solid #10b981;
        background: #ecfdf5;
        color: #047857;
        font-weight: 800;
    }
    #outlook-bulk-name-email-preview div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 10px;
        border-bottom: 1px solid #e2e8f0;
    }
    .outlook-checklist-toggle {
        min-height: 36px;
        padding: 0 12px;
        border: 1px solid #f59e0b;
        border-radius: 999px;
        background: #fff7ed;
        color: #c2410c;
        font-weight: 800;
    }
    .outlook-checklist-collapsed > *:not(.outlook-checklist-toggle) {
        display: none !important;
    }
`;
document.head.appendChild(outlookAssistEnhancementStyle);

const runOutlookAssistEnhancements = () => {
    return;
    enhanceOutlookAssistDuplicateWarning();
    enhanceOutlookAssistDateFormatControl();
    enhanceOutlookAssistChecklistToggle();
    enhanceOutlookAssistTemplateSearch();
    normalizeOutlookAssistPreferredDateNow();
};

document.addEventListener('DOMContentLoaded', runOutlookAssistEnhancements);
document.addEventListener('input', () => setTimeout(runOutlookAssistEnhancements, 0), true);
document.addEventListener('click', event => {
    if (event.target?.closest?.('button, input, textarea, select, a, label')) return;
    setTimeout(runOutlookAssistEnhancements, 0);
}, true);
new MutationObserver(runOutlookAssistEnhancements).observe(document.documentElement, {
    childList: true,
    subtree: true
});

try {
    if (navigator.clipboard?.writeText && !navigator.clipboard.writeText.outlookAssistPreferredDateNormalized) {
        const previousWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
        const preferredWriteText = text => previousWriteText(normalizeOutlookAssistPreferredDateText(text));
        preferredWriteText.outlookAssistPreferredDateNormalized = true;
        navigator.clipboard.writeText = preferredWriteText;
    }
} catch (error) {
    // Clipboard methods may be read-only in some browser contexts.
}

const outlookAssistChecklistRecoveryStyle = document.createElement('style');
outlookAssistChecklistRecoveryStyle.textContent = `
    .outlook-checklist-collapsed > *:not(.outlook-checklist-toggle) {
        display: revert !important;
    }
    .outlook-checklist-toggle {
        width: auto !important;
        height: 36px !important;
        min-height: 36px !important;
        padding: 0 12px !important;
        border-radius: 999px !important;
    }
    #outlook-bulk-name-email-modal:not(.is-open) {
        display: none !important;
        pointer-events: none !important;
    }
    body > .outlook-bulk-modal-backdrop,
    body > .outlook-bulk-modal-panel {
        display: none !important;
        pointer-events: none !important;
    }
`;
document.head.appendChild(outlookAssistChecklistRecoveryStyle);

const recoverOutlookAssistChecklistLayout = () => {
    return;
    document.querySelectorAll('#outlook-bulk-name-email-modal:not(.is-open)').forEach(modal => modal.remove());
    document.querySelectorAll('.outlook-checklist-toggle').forEach(button => button.remove());
    document.querySelectorAll('.outlook-checklist-collapsed').forEach(element => {
        element.classList.remove('outlook-checklist-collapsed');
    });
};

document.addEventListener('DOMContentLoaded', recoverOutlookAssistChecklistLayout);
new MutationObserver(recoverOutlookAssistChecklistLayout).observe(document.documentElement, {
    childList: true,
    subtree: true
});

var outlookAssistDateFormatSafeKey = 'outlookAssistDateFormat';
var getOutlookAssistDateFormatSafe = function () {
    return localStorage.getItem(outlookAssistDateFormatSafeKey) || 'slash';
};
var formatOutlookAssistDateSafe = function (month, day) {
    var m = Number(month);
    var d = Number(day);
    if (!m || !d) return String(month || '') + '/' + String(day || '');
    var format = getOutlookAssistDateFormatSafe();
    if (format === 'jp') return m + '月' + d + '日';
    if (format === 'weekday') {
        var now = new Date();
        var date = new Date(now.getFullYear(), m - 1, d);
        var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return m + '/' + d + '(' + weekdays[date.getDay()] + ')';
    }
    return m + '/' + d;
};
var normalizeOutlookAssistDateSafeText = function (value) {
    return String(value || '')
        .replace(/\b(0?[1-9]|1[0-2])\/([12]\d|3[01]|0?[1-9])(?:\([日月火水木金土]\))*/g, function (_, month, day) {
            return formatOutlookAssistDateSafe(month, day);
        })
        .replace(/\b(0?[1-9]|1[0-2])月([12]\d|3[01]|0?[1-9])日\b/g, function (_, month, day) {
            return formatOutlookAssistDateSafe(month, day);
        });
};
var normalizeOutlookAssistDateSafeFields = function () {
    document.querySelectorAll('input, textarea').forEach(function (field) {
        var id = String(field.id || '');
        var area = field.closest?.('[data-view="outlook-assist"], .outlook-assist, [class*="outlook"]');
        if (!id.includes('outlook-assist') && !area) return;
        var current = field.value;
        var normalized = normalizeOutlookAssistDateSafeText(current);
        if (current !== normalized) field.value = normalized;
    });
    document.querySelectorAll('[class*="outlook"], [id*="outlook"]').forEach(function (element) {
        if (element.children.length || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) return;
        var current = element.textContent;
        var normalized = normalizeOutlookAssistDateSafeText(current);
        if (current !== normalized) element.textContent = normalized;
    });
};
var installOutlookAssistDateFormatControlSafe = function () {
    if (document.getElementById('outlook-assist-date-format-safe')) return;
    var anchor = [...document.querySelectorAll('button')].find(function (button) {
        return String(button.textContent || '').includes('本文を大きく');
    }) || [...document.querySelectorAll('button')].find(function (button) {
        return String(button.textContent || '').includes('本文コピー');
    });
    var area = anchor?.parentElement;
    if (!area) return;
    var label = document.createElement('label');
    label.id = 'outlook-assist-date-format-safe';
    label.className = 'outlook-date-format-control';
    label.innerHTML = '<i class="fa-solid fa-calendar-day"></i><span>日付形式</span><select aria-label="日付形式"><option value="slash">7/4</option><option value="jp">7月4日</option><option value="weekday">7/4(火)</option></select>';
    var select = label.querySelector('select');
    select.value = getOutlookAssistDateFormatSafe();
    select.addEventListener('change', function (event) {
        localStorage.setItem(outlookAssistDateFormatSafeKey, event.target.value);
        normalizeOutlookAssistDateSafeFields();
        var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
        outlookApp?.renderOutlookAssistPreview?.();
    });
    area.appendChild(label);
};
var refreshOutlookAssistDateFeatureSafe = function () {
    installOutlookAssistDateFormatControlSafe();
    normalizeOutlookAssistDateSafeFields();
};
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(refreshOutlookAssistDateFeatureSafe, 0);
});
document.addEventListener('click', function (event) {
    var text = String(event.target?.textContent || '');
    if (text.includes('{日付}') || event.target?.closest?.('#outlook-assist-date-format-safe')) {
        setTimeout(refreshOutlookAssistDateFeatureSafe, 0);
    }
}, true);
if (MaintenanceApp?.prototype?.renderOutlookAssist && !MaintenanceApp.prototype.renderOutlookAssist.outlookDateSafeControl) {
    var originalRenderOutlookAssistForDateSafe = MaintenanceApp.prototype.renderOutlookAssist;
    var renderOutlookAssistWithDateSafe = function () {
        var result = originalRenderOutlookAssistForDateSafe.apply(this, arguments);
        setTimeout(refreshOutlookAssistDateFeatureSafe, 0);
        return result;
    };
    renderOutlookAssistWithDateSafe.outlookDateSafeControl = true;
    MaintenanceApp.prototype.renderOutlookAssist = renderOutlookAssistWithDateSafe;
}
if (MaintenanceApp?.prototype?.renderOutlookAssistPreview && !MaintenanceApp.prototype.renderOutlookAssistPreview.outlookDateSafeControl) {
    var originalRenderOutlookAssistPreviewForDateSafe = MaintenanceApp.prototype.renderOutlookAssistPreview;
    var renderOutlookAssistPreviewWithDateSafe = function () {
        var result = originalRenderOutlookAssistPreviewForDateSafe.apply(this, arguments);
        setTimeout(normalizeOutlookAssistDateSafeFields, 0);
        return result;
    };
    renderOutlookAssistPreviewWithDateSafe.outlookDateSafeControl = true;
    MaintenanceApp.prototype.renderOutlookAssistPreview = renderOutlookAssistPreviewWithDateSafe;
}

var getOutlookAssistTodayInsertTextSafe = function () {
    var now = new Date();
    return formatOutlookAssistDateSafe(now.getMonth() + 1, now.getDate());
};

var replaceOutlookAssistDateTokenAtSourceSafe = function (value) {
    return String(value || '')
        .replace(/\{日付\}/g, getOutlookAssistTodayInsertTextSafe())
        .replace(/\{date\}/gi, getOutlookAssistTodayInsertTextSafe());
};

[
    'replaceOutlookAssistTokens',
    'applyOutlookAssistMergeValues',
    'getOutlookAssistCopyText',
    'getOutlookAssistPreviewText',
    'buildOutlookAssistCopyText',
    'buildOutlookAssistPreviewText'
].forEach(function (methodName) {
    var original = MaintenanceApp?.prototype?.[methodName];
    if (typeof original !== 'function' || original.outlookDateSourceIntegrated) return;
    var wrapped = function () {
        var args = Array.from(arguments).map(function (arg) {
            return typeof arg === 'string' ? replaceOutlookAssistDateTokenAtSourceSafe(arg) : arg;
        });
        var result = original.apply(this, args);
        return typeof result === 'string'
            ? normalizeOutlookAssistDateSafeText(replaceOutlookAssistDateTokenAtSourceSafe(result))
            : result;
    };
    wrapped.outlookDateSourceIntegrated = true;
    MaintenanceApp.prototype[methodName] = wrapped;
});

var integrateOutlookAssistDateTokenButtonsSafe = function () {
    document.addEventListener('click', function (event) {
        var button = event.target?.closest?.('button');
        if (!button || String(button.textContent || '').trim() !== '{日付}') return;
        setTimeout(function () {
            var active = document.activeElement;
            if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) {
                active.value = replaceOutlookAssistDateTokenAtSourceSafe(active.value);
            }
            var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
            outlookApp?.renderOutlookAssistPreview?.();
        }, 0);
    }, true);
};

if (!window.outlookAssistDateTokenButtonsIntegrated) {
    window.outlookAssistDateTokenButtonsIntegrated = true;
    integrateOutlookAssistDateTokenButtonsSafe();
}

var getOutlookAssistDuplicateRecipientsSafe = function (outlookApp) {
    if (!outlookApp?.getCurrentOutlookAssistDraft || !outlookApp?.splitOutlookAssistRecipients) return [];
    var draft = outlookApp.getCurrentOutlookAssistDraft();
    var labels = { to: '宛先', cc: 'CC', bcc: 'BCC' };
    var contacts = outlookApp.getOutlookAssistState?.().recipientContacts || [];
    var contactByEmail = new Map(contacts.map(function (contact) {
        return [MaintenanceApp.toHalfWidthLower(contact.email || ''), contact];
    }));
    var rows = new Map();
    ['to', 'cc', 'bcc'].forEach(function (field) {
        outlookApp.splitOutlookAssistRecipients(draft[field] || '').forEach(function (item) {
            var key = MaintenanceApp.toHalfWidthLower(item);
            if (!key) return;
            var contact = contactByEmail.get(key);
            var label = contact ? (contact.familyName || outlookApp.getOutlookAssistContactName(contact)) : item;
            if (!rows.has(key)) rows.set(key, { label: label, fields: [] });
            rows.get(key).fields.push(labels[field]);
        });
    });
    return Array.from(rows.values()).filter(function (row) {
        return new Set(row.fields).size > 1 || row.fields.length > 1;
    }).map(function (row) {
        return {
            label: row.label,
            fields: Array.from(new Set(row.fields))
        };
    });
};

var renderOutlookAssistDuplicateWarningSafe = function () {
    var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    var existing = document.getElementById('outlook-assist-duplicate-warning-safe');
    if (!outlookApp) {
        existing?.remove();
        return;
    }
    var duplicates = getOutlookAssistDuplicateRecipientsSafe(outlookApp);
    if (!duplicates.length) {
        existing?.remove();
        return;
    }
    var anchor = document.querySelector('#outlook-assist-bcc')?.closest?.('.outlook-recipient-field')
        || document.querySelector('#outlook-assist-bcc')?.parentElement
        || document.querySelector('#outlook-assist-to')?.parentElement;
    if (!anchor) return;
    var panel = existing || document.createElement('div');
    panel.id = 'outlook-assist-duplicate-warning-safe';
    panel.innerHTML = '<strong><i class="fa-solid fa-triangle-exclamation"></i> 宛先重複</strong>' + duplicates.map(function (item) {
        return '<span>' + outlookApp.escapeHtml(item.label) + ': ' + outlookApp.escapeHtml(item.fields.join(' / ')) + '</span>';
    }).join('');
    if (!existing) anchor.insertAdjacentElement('afterend', panel);
};

var scheduleOutlookAssistDuplicateWarningSafe = function () {
    setTimeout(renderOutlookAssistDuplicateWarningSafe, 0);
};

[
    'commitOutlookAssistRecipientField',
    'appendOutlookAssistEmailsToField',
    'removeOutlookAssistRecipientChip',
    'saveOutlookAssistDraftFromForm',
    'renderOutlookAssist'
].forEach(function (methodName) {
    var original = MaintenanceApp?.prototype?.[methodName];
    if (typeof original !== 'function' || original.outlookDuplicateSafeWrapped) return;
    var wrapped = function () {
        var result = original.apply(this, arguments);
        scheduleOutlookAssistDuplicateWarningSafe();
        return result;
    };
    wrapped.outlookDuplicateSafeWrapped = true;
    MaintenanceApp.prototype[methodName] = wrapped;
});

var outlookAssistDuplicateWarningSafeStyle = document.createElement('style');
outlookAssistDuplicateWarningSafeStyle.textContent = `
    #outlook-assist-duplicate-warning-safe {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin: 6px 0 8px;
        padding: 8px 10px;
        border: 1px solid #f59e0b;
        border-radius: 10px;
        background: #fff7ed;
        color: #9a3412;
        font-weight: 800;
    }
    #outlook-assist-duplicate-warning-safe span {
        padding: 3px 8px;
        border-radius: 999px;
        background: #ffedd5;
    }
`;
document.head.appendChild(outlookAssistDuplicateWarningSafeStyle);

var OUTLOOK_ASSIST_DATE_FORMAT_BY_WORKER_KEY = 'outlookAssistDateFormatByWorker';
var getOutlookAssistSelectedWorkerForDateSafe = function () {
    var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    return outlookApp?.getOutlookAssistState?.().selectedWorker || '';
};
var getOutlookAssistDateFormatMapSafe = function () {
    try {
        return JSON.parse(localStorage.getItem(OUTLOOK_ASSIST_DATE_FORMAT_BY_WORKER_KEY) || '{}') || {};
    } catch (error) {
        return {};
    }
};
var saveOutlookAssistDateFormatForWorkerSafe = function (format) {
    var worker = getOutlookAssistSelectedWorkerForDateSafe();
    var map = getOutlookAssistDateFormatMapSafe();
    if (worker) map[worker] = format;
    localStorage.setItem(OUTLOOK_ASSIST_DATE_FORMAT_BY_WORKER_KEY, JSON.stringify(map));
    localStorage.setItem(outlookAssistDateFormatSafeKey, format);
};
getOutlookAssistDateFormatSafe = function () {
    var worker = getOutlookAssistSelectedWorkerForDateSafe();
    var map = getOutlookAssistDateFormatMapSafe();
    return (worker && map[worker]) || localStorage.getItem(outlookAssistDateFormatSafeKey) || 'slash';
};

var openOutlookAssistBulkTextExpandSafe = function (sourceTextarea) {
    if (!sourceTextarea) return;
    document.getElementById('outlook-bulk-text-expand-modal')?.remove();
    var modal = document.createElement('div');
    modal.id = 'outlook-bulk-text-expand-modal';
    modal.innerHTML = `
        <div class="outlook-bulk-text-expand-backdrop"></div>
        <section class="outlook-bulk-text-expand-panel" role="dialog" aria-modal="true" aria-label="名前メールを拡大編集">
            <div class="outlook-bulk-text-expand-head">
                <strong><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 名前メールを拡大編集</strong>
                <button type="button" class="outlook-bulk-text-expand-close" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <textarea id="outlook-bulk-text-expand-input" placeholder="山田 太郎 <taro@example.com>"></textarea>
            <div class="outlook-bulk-text-expand-footer">
                <span>ここで編集した内容は元の入力欄へ反映されます。</span>
                <button type="button" class="outlook-bulk-text-expand-done"><i class="fa-solid fa-check"></i> 戻る</button>
            </div>
        </section>
    `;
    document.body.appendChild(modal);
    var expanded = modal.querySelector('#outlook-bulk-text-expand-input');
    var close = function () {
        sourceTextarea.value = expanded.value;
        sourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        modal.remove();
        sourceTextarea.focus();
    };
    expanded.value = sourceTextarea.value || '';
    expanded.addEventListener('input', function () {
        sourceTextarea.value = expanded.value;
        sourceTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    modal.querySelector('.outlook-bulk-text-expand-backdrop').addEventListener('click', close);
    modal.querySelector('.outlook-bulk-text-expand-close').addEventListener('click', close);
    modal.querySelector('.outlook-bulk-text-expand-done').addEventListener('click', close);
    modal.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') close();
    });
    setTimeout(function () {
        expanded.focus();
        expanded.setSelectionRange(expanded.value.length, expanded.value.length);
    }, 0);
};

var installOutlookAssistInlineBulkPanelSafe = function () {
    document.getElementById('outlook-bulk-name-email-modal')?.remove();
    var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!outlookApp?.parseOutlookAssistNameEmailEntries) return null;
    var anchor = document.querySelector('.outlook-bulk-name-email-import')
        || [...document.querySelectorAll('button')].find(function (button) {
            return String(button.textContent || '').includes('名前メール一括登録') || String(button.textContent || '').includes('宛先管理');
        });
    if (!anchor) return null;
    var area = anchor.closest?.('[class*="outlook"]') || anchor.parentElement;
    if (!area) return null;
    var panel = document.getElementById('outlook-inline-bulk-name-email-panel');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'outlook-inline-bulk-name-email-panel';
    panel.hidden = true;
    panel.innerHTML = `
        <div class="outlook-inline-bulk-head">
            <strong><i class="fa-solid fa-address-book"></i> 名前メール一括登録</strong>
            <button type="button" class="outlook-inline-bulk-close" aria-label="閉じる"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="outlook-inline-bulk-grid">
            <label>グループ名<input id="outlook-inline-bulk-group" placeholder="例: プラント"></label>
            <label class="outlook-inline-bulk-text-label">
                <span class="outlook-inline-bulk-label-row">名前 &lt;メールアドレス&gt;<button type="button" id="outlook-inline-bulk-expand"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> 拡大</button></span>
                <textarea id="outlook-inline-bulk-text" placeholder="山田 太郎 <taro@example.com>"></textarea>
            </label>
        </div>
        <div class="outlook-inline-bulk-actions">
            <button type="button" id="outlook-inline-bulk-preview"><i class="fa-solid fa-eye"></i> プレビュー</button>
            <button type="button" id="outlook-inline-bulk-register"><i class="fa-solid fa-address-book"></i> 登録</button>
        </div>
        <div id="outlook-inline-bulk-preview-list">貼り付け後にプレビューできます。</div>
    `;
    area.insertAdjacentElement('afterend', panel);
    var renderPreview = function () {
        var entries = outlookApp.parseOutlookAssistNameEmailEntries(panel.querySelector('#outlook-inline-bulk-text').value).filter(function (entry) {
            return entry.email;
        });
        panel.querySelector('#outlook-inline-bulk-preview-list').innerHTML = entries.length
            ? entries.map(function (entry) {
                return '<div><b>' + outlookApp.escapeHtml(entry.displayName || entry.email) + '</b><span>' + outlookApp.escapeHtml(entry.email) + '</span></div>';
            }).join('')
            : 'メールアドレスを読み取れませんでした。';
        return entries;
    };
    panel.querySelector('.outlook-inline-bulk-close').addEventListener('click', function () {
        panel.hidden = true;
    });
    panel.querySelector('#outlook-inline-bulk-expand').addEventListener('click', function () {
        openOutlookAssistBulkTextExpandSafe(panel.querySelector('#outlook-inline-bulk-text'));
    });
    panel.querySelector('#outlook-inline-bulk-preview').addEventListener('click', renderPreview);
    panel.querySelector('#outlook-inline-bulk-register').addEventListener('click', function () {
        var group = panel.querySelector('#outlook-inline-bulk-group').value.trim();
        var entries = renderPreview();
        if (!group) {
            alert('グループ名を入力してください。');
            return;
        }
        if (!entries.length) return;
        var state = outlookApp.getOutlookAssistState();
        var contacts = state.recipientContacts || [];
        entries.forEach(function (entry) {
            var emailKey = MaintenanceApp.toHalfWidthLower(entry.email);
            var existing = contacts.find(function (contact) {
                return MaintenanceApp.toHalfWidthLower(contact.email || '') === emailKey;
            });
            var nameParts = String(entry.displayName || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
            var familyName = nameParts[0] || entry.email;
            var givenName = nameParts.slice(1).join(' ');
            if (existing) {
                existing.familyName = existing.familyName || familyName;
                existing.givenName = existing.givenName || givenName;
                var groups = Array.isArray(existing.groups)
                    ? existing.groups
                    : String(existing.group || '').split(/[;,、\n]+/).map(function (item) { return item.trim(); }).filter(Boolean);
                if (!groups.includes(group) && groups.length < 7) groups.push(group);
                existing.groups = groups;
                existing.group = groups.join(', ');
                existing.updatedAt = new Date().toISOString();
            } else {
                contacts.push({
                    id: 'contact-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
                    familyName: familyName,
                    givenName: givenName,
                    email: entry.email,
                    groups: [group],
                    group: group,
                    note: '',
                    updatedAt: new Date().toISOString()
                });
            }
        });
        state.recipientContacts = contacts;
        store.save();
        panel.querySelector('#outlook-inline-bulk-text').value = '';
        panel.querySelector('#outlook-inline-bulk-preview-list').textContent = entries.length + '件を「' + group + '」に登録しました。';
        outlookApp.renderOutlookAssist?.();
    });
    return panel;
};

MaintenanceApp.prototype.bulkRegisterOutlookAssistNameEmailGroup = function () {
    var panel = installOutlookAssistInlineBulkPanelSafe();
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
        var groupInput = panel.querySelector('#outlook-inline-bulk-group');
        var managingGroup = String(this._outlookAssistManagingGroup || '').trim();
        if (groupInput && managingGroup && managingGroup !== TXT.noGroup && !groupInput.value.trim()) {
            groupInput.value = managingGroup;
        }
        groupInput?.focus();
    }
};

var outlookAssistInlineBulkPanelStyle = document.createElement('style');
outlookAssistInlineBulkPanelStyle.textContent = `
    #outlook-inline-bulk-name-email-panel {
        margin: 10px 0;
        padding: 12px;
        border: 1px solid #fed7aa;
        border-radius: 12px;
        background: #fff7ed;
        color: #0f172a;
    }
    .outlook-inline-bulk-head,
    .outlook-inline-bulk-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
    }
    .outlook-inline-bulk-grid {
        display: grid;
        gap: 10px;
    }
    #outlook-inline-bulk-name-email-panel label {
        display: grid;
        gap: 6px;
        font-weight: 800;
    }
    .outlook-inline-bulk-label-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }
    #outlook-inline-bulk-expand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 32px;
        padding: 0 10px;
        border: 1px solid #f59e0b;
        border-radius: 999px;
        background: #fff7ed;
        color: #c2410c;
        font-size: 0.74rem;
        font-weight: 900;
        cursor: pointer;
        white-space: nowrap;
    }
    #outlook-inline-bulk-expand:hover {
        background: #fed7aa;
        color: #7c2d12;
    }
    #outlook-inline-bulk-name-email-panel input,
    #outlook-inline-bulk-name-email-panel textarea {
        width: 100%;
        border: 1px solid #bfdbfe;
        border-radius: 10px;
        background: #eff6ff;
        padding: 9px 10px;
        font: inherit;
    }
    #outlook-inline-bulk-name-email-panel textarea {
        min-height: 110px;
        resize: vertical;
    }
    .outlook-inline-bulk-close,
    .outlook-inline-bulk-actions button {
        min-height: 38px;
        padding: 0 12px;
        border: 1px solid #f59e0b;
        border-radius: 10px;
        background: #ffffff;
        color: #c2410c;
        font-weight: 800;
        cursor: pointer;
    }
    #outlook-inline-bulk-preview-list {
        max-height: 180px;
        overflow: auto;
        border-radius: 10px;
        background: #ffffff;
    }
    #outlook-inline-bulk-preview-list div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 7px 10px;
        border-bottom: 1px solid #e2e8f0;
    }
    #outlook-bulk-text-expand-modal {
        position: fixed;
        inset: 0;
        z-index: 12000;
        display: grid;
        place-items: center;
        padding: 24px;
    }
    .outlook-bulk-text-expand-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.46);
    }
    .outlook-bulk-text-expand-panel {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
        width: min(980px, calc(100vw - 48px));
        height: min(720px, calc(100vh - 64px));
        padding: 16px;
        border: 2px solid #f59e0b;
        border-radius: 16px;
        background: #fff7ed;
        box-shadow: 0 24px 80px rgba(15, 23, 42, 0.26);
    }
    .outlook-bulk-text-expand-head,
    .outlook-bulk-text-expand-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    .outlook-bulk-text-expand-head strong {
        color: #0f172a;
        font-size: 1.05rem;
        font-weight: 950;
    }
    .outlook-bulk-text-expand-close,
    .outlook-bulk-text-expand-done {
        min-height: 42px;
        padding: 0 14px;
        border: 1px solid #f59e0b;
        border-radius: 12px;
        background: #ffffff;
        color: #c2410c;
        font-weight: 900;
        cursor: pointer;
    }
    .outlook-bulk-text-expand-close {
        width: 46px;
        padding: 0;
        font-size: 1.1rem;
    }
    #outlook-bulk-text-expand-input {
        flex: 1;
        width: 100%;
        min-height: 0;
        resize: none;
        padding: 14px;
        border: 2px solid #bfdbfe;
        border-radius: 14px;
        background: #eff6ff;
        color: #0f172a;
        font: inherit;
        font-size: 1rem;
        line-height: 1.55;
    }
    #outlook-bulk-text-expand-input:focus {
        outline: none;
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.16);
    }
    .outlook-bulk-text-expand-footer span {
        color: #64748b;
        font-size: 0.78rem;
        font-weight: 850;
    }
`;
document.head.appendChild(outlookAssistInlineBulkPanelStyle);

if (!window.outlookAssistDateFormatSelectPerWorkerIntegrated) {
    window.outlookAssistDateFormatSelectPerWorkerIntegrated = true;
    document.addEventListener('change', function (event) {
        var select = event.target?.closest?.('#outlook-assist-date-format-safe select');
        if (!select) return;
        saveOutlookAssistDateFormatForWorkerSafe(select.value);
    }, true);
}

var showOutlookAssistCopyDoneSafe = function (label) {
    var notice = document.getElementById('outlook-assist-copy-done-safe');
    if (!notice) {
        notice = document.createElement('div');
        notice.id = 'outlook-assist-copy-done-safe';
        document.body.appendChild(notice);
    }
    notice.textContent = label + 'をコピーしました';
    notice.classList.add('is-visible');
    clearTimeout(notice._hideTimer);
    notice._hideTimer = setTimeout(function () {
        notice.classList.remove('is-visible');
    }, 1400);
};

document.addEventListener('click', function (event) {
    var button = event.target?.closest?.('button');
    if (!button) return;
    var text = String(button.textContent || '').replace(/\s+/g, '');
    var label = '';
    if (text.includes('全文コピー')) label = '全文';
    else if (text.includes('本文コピー')) label = '本文';
    else if (text.includes('件名コピー')) label = '件名';
    else if (text.includes('宛先コピー')) label = '宛先';
    else if (text.includes('CCコピー')) label = 'CC';
    else if (text.includes('BCCコピー')) label = 'BCC';
    if (!label) return;
    setTimeout(function () {
        showOutlookAssistCopyDoneSafe(label);
    }, 80);
}, true);

var outlookAssistCopyDoneSafeStyle = document.createElement('style');
outlookAssistCopyDoneSafeStyle.textContent = `
    #outlook-assist-copy-done-safe {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 99999;
        transform: translateY(12px);
        opacity: 0;
        pointer-events: none;
        padding: 12px 16px;
        border-radius: 999px;
        background: #10b981;
        color: #ffffff;
        font-weight: 900;
        box-shadow: 0 14px 32px rgba(16, 185, 129, 0.28);
        transition: opacity 0.16s ease, transform 0.16s ease;
    }
    #outlook-assist-copy-done-safe.is-visible {
        opacity: 1;
        transform: translateY(0);
    }
    #outlook-assist-date-format-safe span {
        font-weight: 900;
        white-space: nowrap;
    }
`;
document.head.appendChild(outlookAssistCopyDoneSafeStyle);

document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var outlookApp = window.app || (typeof app !== 'undefined' ? app : null);
    if (!outlookApp) return;
    if (document.getElementById('outlook-template-apply-choice')) {
        outlookApp.closeOutlookAssistTemplateApplyChoice?.();
        return;
    }
    if (outlookApp._outlookAssistShowDraftPageList) {
        outlookApp.closeOutlookAssistDraftPageList?.();
    }
}, true);

const normalizeOutlookAssistShortDateText = value => String(value || '').replace(/\b(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\b/g, (_, month, day) => {
    return `${Number(month)}/${Number(day)}`;
});

const normalizeOutlookAssistShortDateFields = () => {
    document.querySelectorAll('input[id^="outlook-assist-"], textarea[id^="outlook-assist-"]').forEach(field => {
        const current = field.value;
        const normalized = normalizeOutlookAssistShortDateText(current);
        if (current !== normalized) field.value = normalized;
    });
};

document.addEventListener('DOMContentLoaded', normalizeOutlookAssistShortDateFields);
new MutationObserver(normalizeOutlookAssistShortDateFields).observe(document.documentElement, {
    childList: true,
    subtree: true
});

try {
    if (navigator.clipboard?.writeText && !navigator.clipboard.writeText.outlookAssistShortDateNormalized) {
        const originalOutlookAssistClipboardWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
        const normalizedWriteText = text => originalOutlookAssistClipboardWriteText(normalizeOutlookAssistShortDateText(text));
        normalizedWriteText.outlookAssistShortDateNormalized = true;
        navigator.clipboard.writeText = normalizedWriteText;
    }
} catch (error) {
    // Some browsers do not allow replacing clipboard methods.
}

const normalizeOutlookAssistShortDateFieldsNow = () => {
    return;
    const active = document.activeElement;
    document.querySelectorAll('input, textarea').forEach(field => {
        const id = String(field.id || '');
        const area = field.closest?.('[data-view="outlook-assist"], .outlook-assist, [class*="outlook"]');
        if (!id.includes('outlook-assist') && !area) return;
        const current = field.value;
        const normalized = normalizeOutlookAssistShortDateText(current);
        if (current === normalized) return;
        const start = field.selectionStart;
        const end = field.selectionEnd;
        field.value = normalized;
        if (field === active && typeof start === 'number' && typeof end === 'number') {
            const diff = current.length - normalized.length;
            field.setSelectionRange(Math.max(0, start - diff), Math.max(0, end - diff));
        }
    });
    document.querySelectorAll('[class*="outlook"], [id*="outlook"]').forEach(element => {
        if (element.children.length || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(element.tagName)) return;
        const current = element.textContent;
        const normalized = normalizeOutlookAssistShortDateText(current);
        if (current !== normalized) element.textContent = normalized;
    });
};

document.addEventListener('click', () => setTimeout(normalizeOutlookAssistShortDateFieldsNow, 0), true);
document.addEventListener('input', () => setTimeout(normalizeOutlookAssistShortDateFieldsNow, 0), true);
document.addEventListener('keyup', () => setTimeout(normalizeOutlookAssistShortDateFieldsNow, 0), true);
document.addEventListener('focusout', normalizeOutlookAssistShortDateFieldsNow, true);
setInterval(normalizeOutlookAssistShortDateFieldsNow, 800);

if (document.execCommand && !document.execCommand.outlookAssistShortDateNormalized) {
    const originalOutlookAssistExecCommand = document.execCommand.bind(document);
    const normalizedExecCommand = (command, showUi, value) => {
        normalizeOutlookAssistShortDateFieldsNow();
        return originalOutlookAssistExecCommand(command, showUi, value);
    };
    normalizedExecCommand.outlookAssistShortDateNormalized = true;
    document.execCommand = normalizedExecCommand;
}

[
    'getOutlookAssistTokenValue',
    'resolveOutlookAssistToken',
    'replaceOutlookAssistTokens',
    'applyOutlookAssistMergeValues',
    'getOutlookAssistCopyText',
    'getOutlookAssistPreviewText'
].forEach(methodName => {
    const original = MaintenanceApp.prototype[methodName];
    if (typeof original !== 'function' || original.outlookAssistShortDateNormalized) return;
    const wrapped = function (...args) {
        return normalizeOutlookAssistShortDateText(original.apply(this, args));
    };
    wrapped.outlookAssistShortDateNormalized = true;
    MaintenanceApp.prototype[methodName] = wrapped;
});
})();
