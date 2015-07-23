package com.psddev.cms.tool.page.content;

import com.google.common.collect.ImmutableMap;
import com.psddev.cms.db.Content;
import com.psddev.cms.db.ToolUser;
import com.psddev.cms.tool.page.RtcBroadcast;
import com.psddev.dari.db.State;

import java.util.Date;
import java.util.Map;
import java.util.UUID;

public class PublishBroadcast implements RtcBroadcast<Object> {

    @Override
    public Map<String, Object> create(UUID currentUserId, Object object) {
        State state = State.getInstance(object);
        Content.ObjectModification contentData = state.as(Content.ObjectModification.class);
        ToolUser user = contentData.getUpdateUser();
        Date date = contentData.getUpdateDate();

        if (user == null || date == null) {
            return null;
        }

        return ImmutableMap.of(
                "userId", user.getId().toString(),
                "userName", user.getName(),
                "date", date.getTime(),
                "contentId", state.getId().toString(),
                "values", state.getSimpleValues()
        );
    }
}
