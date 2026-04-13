public class SessionContextDTO {
    private String sessionId;
    private ViewerType activeViewer;
    private SessionStatus status;
    private String activeResourceId;

    private Map<String, Object> viewerState;
}